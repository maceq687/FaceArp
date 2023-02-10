let device;

async function setup() {
    const patchExportURL = "export/patch.export.json";

    // Create AudioContext
    const WAContext = window.AudioContext || window.webkitAudioContext;
    const context = new WAContext();

    // Create gain node and connect it to audio output
    const outputNode = context.createGain();
    outputNode.connect(context.destination);
    
    // Fetch the exported patcher
    let response, patcher;
    try {
        response = await fetch(patchExportURL);
        patcher = await response.json();
    
        if (!window.RNBO) {
            // Load RNBO script dynamically
            // Note that you can skip this by knowing the RNBO version of your patch
            // beforehand and just include it using a <script> tag
            await loadRNBOScript(patcher.desc.meta.rnboversion);
        }

    } catch (err) {
        const errorContext = {
            error: err
        };
        if (response && (response.status >= 300 || response.status < 200)) {
            errorContext.header = `Couldn't load patcher export bundle`,
            errorContext.description = `Check app.js to see what file it's trying to load. Currently it's` +
            ` trying to load "${patchExportURL}". If that doesn't` + 
            ` match the name of the file you exported from RNBO, modify` + 
            ` patchExportURL in app.js.`;
        }
        if (typeof guardrails === "function") {
            guardrails(errorContext);
        } else {
            throw err;
        }
        return;
    }
    
    // Create the device
    try {
        device = await RNBO.createDevice({ context, patcher });
    } catch (err) {
        if (typeof guardrails === "function") {
            guardrails({ error: err });
        } else {
            throw err;
        }
        return;
    }

    // Connect the device to the web audio graph
    device.node.connect(outputNode);

    // (Optional) Extract the name and rnbo version of the patcher from the description
    document.getElementById("patcher-title").innerText = (patcher.desc.meta.filename || "Unnamed Patcher") + " (v" + patcher.desc.meta.rnboversion + ")";

    // (Optional) Automatically create sliders for the device parameters
    makeSliders(device);

    // (Optional) Connect MIDI inputs
    makeMIDIKeyboard(device);

    document.body.onclick = () => {
        context.resume();
    }
    await loadWebMIDI();
    await webMIDIinit(device);

    // Skip if you're not using guardrails.js
    if (typeof guardrails === "function")
        guardrails();
}

function loadRNBOScript(version) {
    return new Promise((resolve, reject) => {
        if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
            throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
        }
        const el = document.createElement("script");
        el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
        el.onload = resolve;
        el.onerror = function(err) {
            console.log(err);
            reject(new Error("Failed to load rnbo.js v" + version));
        };
        document.body.append(el);
    });
}

// using WebMIDI library https://webmidijs.org/docs/getting-started/basics
function loadWebMIDI() {
    return new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = "https://cdn.jsdelivr.net/npm/webmidi@latest/dist/iife/webmidi.iife.js";
        el.onload = resolve;
        el.onerror = function(err) {
            console.log(err);
            reject(new Error("Failed to load webmidi.js"));
        };
        document.body.append(el);
    });
}

//other web MIDI functions are in a midiio.js
function webMIDIinit(device){
  WebMidi
    .enable()
    .then(() => webMIDIstart(device))
    .catch(err => alert(err));
}

function makeSliders(device) {
    let pdiv = document.getElementById("rnbo-parameter-sliders");
    let noParamLabel = document.getElementById("no-param-label");
    if (noParamLabel && device.numParameters > 0) pdiv.removeChild(noParamLabel);

    // This will allow us to ignore parameter update events while dragging the slider.
    let isDraggingSlider = false;
    let uiElements = {};

    device.parameters.forEach(param => {
        // Subpatchers also have params. If we want to expose top-level
        // params only, the best way to determine if a parameter is top level
        // or not is to exclude parameters with a '/' in them.
        // You can uncomment the following line if you don't want to include subpatcher params
        
        //if (param.id.includes("/")) return;

        // Create a label, an input slider and a value display
        let label = document.createElement("label");
        let slider = document.createElement("input");
        let text = document.createElement("input");
        let sliderContainer = document.createElement("div");
        sliderContainer.appendChild(label);
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(text);

        // Add a name for the label
        label.setAttribute("name", param.name);
        label.setAttribute("for", param.name);
        label.setAttribute("class", "param-label");
        label.textContent = `${param.name}: `;

        // Make each slider reflect its parameter
        slider.setAttribute("type", "range");
        slider.setAttribute("class", "param-slider");
        slider.setAttribute("id", param.id);
        slider.setAttribute("name", param.name);
        slider.setAttribute("min", param.min);
        slider.setAttribute("max", param.max);
        if (param.steps > 1) {
            slider.setAttribute("step", (param.max - param.min) / (param.steps - 1));
        } else {
            slider.setAttribute("step", (param.max - param.min) / 1000.0);
        }
        slider.setAttribute("value", param.value);

        // Make a settable text input display for the value
        text.setAttribute("value", param.value.toFixed(1));
        text.setAttribute("type", "text");

        // Make each slider control its parameter
        slider.addEventListener("pointerdown", () => {
            isDraggingSlider = true;
        });
        slider.addEventListener("pointerup", () => {
            isDraggingSlider = false;
            slider.value = param.value;
            text.value = param.value.toFixed(1);
        });
        slider.addEventListener("input", () => {
            let value = Number.parseFloat(slider.value);
            param.value = value;
        });

        // Make the text box input control the parameter value as well
        text.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                let newValue = Number.parseFloat(text.value);
                if (isNaN(newValue)) {
                    text.value = param.value;
                } else {
                    newValue = Math.min(newValue, param.max);
                    newValue = Math.max(newValue, param.min);
                    text.value = newValue;
                    param.value = newValue;
                }
            }
        });

        // Store the slider and text by name so we can access them later
        uiElements[param.id] = { slider, text };

        // Add the slider element
        pdiv.appendChild(sliderContainer);
    });

    // Listen to parameter changes from the device
    device.parameterChangeEvent.subscribe(param => {
        if (!isDraggingSlider)
            uiElements[param.id].slider.value = param.value;
        uiElements[param.id].text.value = param.value.toFixed(1);
    });
}

function makeMIDIKeyboard(device) {
    let mdiv = document.getElementById("rnbo-clickable-keyboard");
    if (device.numMIDIInputPorts === 0) return;

    mdiv.removeChild(document.getElementById("no-midi-label"));

    const midiNotes = [36, 40, 44, 48, 52, 56, 60, 64, 68, 72];
    let midiChannel = 0;
    let midiPort = 0;
    midiNotes.forEach(note => {
        const key = document.createElement("div");
        const label = document.createElement("p");
        label.textContent = note;
        key.appendChild(label);
        key.addEventListener("pointerdown", () => {

            // Format a MIDI message paylaod, this constructs a MIDI on event
            let noteOnMessage = [
                144 + midiChannel, // Code for a note on: 10010000 & midi channel (0-15)
                note, // MIDI Note
                100 // MIDI Velocity
            ];
        
            // Including rnbo.min.js (or the unminified rnbo.js) will add the RNBO object
            // to the global namespace. This includes the TimeNow constant as well as
            // the MIDIEvent constructor.
        
            // When scheduling an event to occur in the future, use the current audio context time
            // multiplied by 1000 (converting seconds to milliseconds) for now.
            let noteOnEvent = new RNBO.MIDIEvent(device.context.currentTime * 1000, midiPort, noteOnMessage);
        
            device.scheduleEvent(noteOnEvent);

            key.classList.add("clicked");
        });

        key.addEventListener("pointerup", () => {
            let noteOffMessage = [
                128 + midiChannel, // Code for a note off: 10000000 & midi channel (0-15)
                note, // MIDI Note
                0 // MIDI Velocity
            ];

            let noteOffEvent = new RNBO.MIDIEvent(device.context.currentTime * 1000, midiPort, noteOffMessage);

            device.scheduleEvent(noteOffEvent);

            key.classList.remove("clicked");
        });

        mdiv.appendChild(key);
    });

    computerKeyboardInit(device);
}

// Computer vision
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
}

function rotationToUnit(angle) {
    angle = Math.min(Math.max(angle, -45), 45);
    angle = (45 + angle) / 90;
    return Math.round(100 * angle) / 100;
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.fillStyle = '#fff7e6E6';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {

            const pTop = new THREE.Vector3(landmarks[10].x, landmarks[10].y, landmarks[10].z);
            const pBottom = new THREE.Vector3(landmarks[152].x, landmarks[152].y, landmarks[152].z);
            const pLeft = new THREE.Vector3(landmarks[234].x, landmarks[234].y, landmarks[234].z);
            const pRight = new THREE.Vector3(landmarks[454].x, landmarks[454].y, landmarks[454].z);

            const pTB = pTop.clone().addScaledVector(pBottom, -1).normalize();
            const pLR = pLeft.clone().addScaledVector(pRight, -1).normalize();

            let yaw = radiansToDegrees(Math.PI / 2 - pLR.angleTo(new THREE.Vector3(0, 0, 1)));
            let pitch = radiansToDegrees(Math.PI / 2 - pTB.angleTo(new THREE.Vector3(0, 0, 1)));
            let roll = radiansToDegrees(Math.PI / 2 - pTB.angleTo(new THREE.Vector3(1, 0, 0)));

            pitch = 2 * pitch;
            roll = 2 * roll;

            yaw = rotationToUnit(yaw);
            pitch = rotationToUnit(pitch);
            roll = rotationToUnit(roll);

            if (pitch < 0.5)
                pitch = 0.3 + pitch;
            else
                pitch = ((pitch - 0.5) * -1) + 0.8;

            let d = Math.sqrt(Math.pow((landmarks[13].x - landmarks[14].x), 2) + Math.pow((landmarks[13].y - landmarks[14].y), 2) + Math.pow((landmarks[13].z - landmarks[14].z), 2));
            d = Math.min((Math.round(1000 * d) / 100), 1);

            // Link sliders to computer vision
            const sliderX = device.parametersById.get("pan");
            if (sliderX)
                sliderX.value = (yaw * 2) - 1;
            const sliderY = device.parametersById.get("probability");
            if (sliderY)
                sliderY.value = pitch * 100;
            const sliderZ = device.parametersById.get("cutoff");
            if (sliderZ)
                sliderZ.value = roll * 100;
            const sliderW = device.parametersById.get("reverb");
            if (sliderW)
                sliderW.value = d * 100;

            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#00049680', lineWidth: 2});
        }
    }
    canvasCtx.restore();
}

const faceMesh = new FaceMesh({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});
faceMesh.setOptions({
    selfieMode: true,
    enableFaceGeometry: false,
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({image: videoElement});
    },
    width: 854,
    height: 480
});
camera.start();

setup();
