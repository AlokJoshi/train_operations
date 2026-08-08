import { createAudioManager } from './utility.js';

const ENABLE_SFX = true;

export const audioManager = createAudioManager(
  {
    beep: './beep.mp3',
    train: './train.wav',
    whistle: './steam_engine_whistle.mp3',
    money: './money.mp3',
    pop: './pop.mp3',
    chugging: './chugging_sound.mp3',
    horn: './horn.mp3',
    traincollide: './traincollide.mp3',
    drumroll: './drumroll.mp3'
  },
  {
    enabled: ENABLE_SFX,
    hornDefaults: {
      baseFrequency: 280,
      duration: 1.75, //0.75
      volume: 0.12,
      detune: 0
    }
  }
);