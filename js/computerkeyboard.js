let main_device;

function computerKeyboardInit(device) {
    main_device = device;
}

let basePitch = 60;

this.addEventListener('keydown', event => {
    let value = event.code;
    switch (value) {
        case 'KeyA':
            computerKeyboardNoteOn(0);
            break;
        case 'KeyW':
            computerKeyboardNoteOn(1);
            break;
        case 'KeyS':
            computerKeyboardNoteOn(2);
            break;
        case 'KeyE':
            computerKeyboardNoteOn(3);
            break;
        case 'KeyD':
            computerKeyboardNoteOn(4);
            break;
        case 'KeyF':
            computerKeyboardNoteOn(5);
            break;
        case 'KeyT':
            computerKeyboardNoteOn(6);
            break;
        case 'KeyG':
            computerKeyboardNoteOn(7);
            break;
        case 'KeyY':
            computerKeyboardNoteOn(8);
            break;
        case 'KeyH':
            computerKeyboardNoteOn(9);
            break;
        case 'KeyU':
            computerKeyboardNoteOn(10);
            break;
        case 'KeyJ':
            computerKeyboardNoteOn(11);
            break;
        case 'KeyZ':
            octaveDown();
            break;
        case 'KeyX':
            octaveUp();
            break;
        default:
            value = 'KeyA';
            break;
    }
  })

  this.addEventListener('keyup', event => {
    let value = event.code;
    switch (value) {
        case 'KeyA':
            computerKeyboardNoteOff(0);
            break;
        case 'KeyW':
            computerKeyboardNoteOff(1);
            break;
        case 'KeyS':
            computerKeyboardNoteOff(2);
            break;
        case 'KeyE':
            computerKeyboardNoteOff(3);
            break;
        case 'KeyD':
            computerKeyboardNoteOff(4);
            break;
        case 'KeyF':
            computerKeyboardNoteOff(5);
            break;
        case 'KeyT':
            computerKeyboardNoteOff(6);
            break;
        case 'KeyG':
            computerKeyboardNoteOff(7);
            break;
        case 'KeyY':
            computerKeyboardNoteOff(8);
            break;
        case 'KeyH':
            computerKeyboardNoteOff(9);
            break;
        case 'KeyU':
            computerKeyboardNoteOff(10);
            break;
        case 'KeyJ':
            computerKeyboardNoteOff(11);
            break;
        default:
            value = 'KeyA';
            break;
    }
  })

function octaveDown() {
    if (basePitch > 24)
        basePitch = basePitch - 12;
}

function octaveUp() {
    if (basePitch < 84)
        basePitch = basePitch + 12;
}

let midiChannel = 0;
let midiPort = 0;

function computerKeyboardNoteOn(keyNumber) {
    let note = keyNumber + basePitch;
    
    let noteOnMessage = [
        144 + midiChannel, // Code for a note on: 10010000 & midi channel (0-15)
        note, // MIDI Note
        100 // MIDI Velocity
    ];

    let noteOnEvent = new RNBO.MIDIEvent(main_device.context.currentTime * 1000, midiPort, noteOnMessage);
    device.scheduleEvent(noteOnEvent);
}

function computerKeyboardNoteOff(keyNumber) {
    let note = keyNumber + basePitch;
    
    let noteOffMessage = [
        128 + midiChannel, // Code for a note off: 10000000 & midi channel (0-15)
        note, // MIDI Note
        0 // MIDI Velocity
    ];

    let noteOffEvent = new RNBO.MIDIEvent(main_device.context.currentTime * 1000, midiPort, noteOffMessage);
    device.scheduleEvent(noteOffEvent);
}