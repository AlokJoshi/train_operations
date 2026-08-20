function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  // You can use the whole div or a specific handle to drag
  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    const interactiveSelector = 'input, textarea, select, button, label, i, a'
    if (e.target.closest(interactiveSelector)) {
      return
    }
    e.preventDefault();
    // Get cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    // Calculate new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }

}

function ck(value) {
  return Math.round(value / 1000)
}

function rowAndColumnName(x, y, gridSize) {
  const n = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const col = Math.floor(x / gridSize)
  const row = Math.floor(y / gridSize)
  const colName = alpha(col)
  const rowName = alpha(row)
  return [rowName, colName]
}

function alpha(index) {
  const n = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return (index >= n.length ? n[Math.floor((index / n.length) - 1)] : '') + n[index % n.length]
}

function getDetailedSegmentsMap(positions, turningCircle = 100, gridSize = 50) {
  if (!Array.isArray(positions) || positions.length < 2) {
    return new Map()
  }
  const segmentsMap = new Map()
  const modifiedPositions = []
  let firstx = positions[0].x
  let firsty = positions[0].y
  let secondx, secondy, thirdx, thirdy
  modifiedPositions.push({ x: firstx, y: firsty })
  for (let i = 1; i < positions.length; i++) {
    secondx = positions[i].x
    secondy = positions[i].y
    thirdx = positions[i + 1]?.x
    thirdy = positions[i + 1]?.y
    if (firstx === secondx && secondx === thirdx) {
      // vertical segment will collapse into a single vertical position in the modifiedPositions array
      if (i == positions.length - 1) {
        modifiedPositions.push({ x: secondx, y: secondy })
      }
    } else if (firsty === secondy && secondy === thirdy) {
      // horizontal segment will collapse into a single horizontal position in the modifiedPositions array
      if (i == positions.length - 1) {
        modifiedPositions.push({ x: secondx, y: secondy })
      }

    } else {
      // neither vertical nor horizontal segment, keep the position as is
      modifiedPositions.push({ x: secondx, y: secondy })
      firstx = secondx
      firsty = secondy
    }
  }
  // console.log(modifiedPositions)
  //now use the modifiedPositions to create the segments map
  //note that our map is for segment betwee each grid position
  let startx, starty, endx, endy
  let newModifiedPositions = []
  let n = 0
  for (let i = 1; i < modifiedPositions.length; i++) {
    startx = modifiedPositions[i - 1].x
    starty = modifiedPositions[i - 1].y
    newModifiedPositions.push({ x: startx, y: starty })
    endx = modifiedPositions[i].x
    endy = modifiedPositions[i].y
    n = i == modifiedPositions.length - 1 ? 1 : 0
    if (endx === startx) {
      //in this case the segment is vertical but because the next segment is going to be horizontal
      //we take off the turning radius  from the end point
      const dir = endy > starty ? 1 : -1
      for (let j = 1; j < Math.abs(starty - endy) / gridSize + n; j++) {
        newModifiedPositions.push({ x: startx, y: starty + j * gridSize * dir, direction: 'vertical' })
      }
    }
    if (endy === starty) {
      //in this case the segment is horizontal but because the next segment is going to be vertical
      //we take off the turning radius  from the end point
      const dir = endx > startx ? 1 : -1
      for (let j = 1; j < Math.abs(startx - endx) / gridSize + n; j++) {
        newModifiedPositions.push({ x: startx + j * gridSize * dir, y: starty, direction: 'horizontal' })
      }
    }
    startx = endx
    starty = endy
  }
  // console.log(newModifiedPositions)
  for (let j = 1; j < newModifiedPositions.length; j++) {
    const prev = newModifiedPositions[j - 1]
    const curr = newModifiedPositions[j]
    if (j > 1 && (prev.direction == 'vertical' || prev.direction == 'horizontal') && curr.direction == null) {
      // mark the previous point as skip
      prev.skip = true
      // mark the current point as skip
      curr.skip = true
      if (j + 2 < newModifiedPositions.length) {
        const next = newModifiedPositions[j + 1]
        next.skip = true
      }
    }
  }

  for (let j = 0; j < newModifiedPositions.length - 1; j++) {
    const start = newModifiedPositions[j]
    const end = newModifiedPositions[j + 1]
    if (start.skip || end.skip) {
      continue
    }
    segmentsMap.set(`${start.x},${start.y}-${end.x},${end.y}`, { startx: start.x, starty: start.y, endx: end.x, endy: end.y })
  }
  return segmentsMap
}

function getCommonSegmentsMap(positions1, positions2, turningCircle = 100, gridSize = 50) {
  const segmentsMap1 = getDetailedSegmentsMap(positions1, turningCircle, gridSize)
  const segmentsMap2 = getDetailedSegmentsMap(positions2, turningCircle, gridSize)
  // console.log(segmentsMap1)
  // console.log(segmentsMap2)
  const commonSegmentsMap = new Map()
  for (const key of segmentsMap1.keys()) {
    const keyAlternative = key.split('-').reverse().join('-')
    if (segmentsMap2.has(key) || segmentsMap2.has(keyAlternative)) {
      commonSegmentsMap.set(key, segmentsMap1.get(key))
    }
  }
  // console.log(commonSegmentsMap)
  return commonSegmentsMap
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createAudioManager(audioSources = {}, { enabled = true, hornDefaults = {} } = {}) {
  const sounds = new Map()
  let mediaUnlocked = false
  let audioEnabled = !!enabled
  let audioContext = null

  const resolvedHornDefaults = {
    baseFrequency: 280,
    duration: 1.7,//0.7
    volume: 0.12,
    detune: 0,
    ...hornDefaults
  }

  const getAudioContext = () => {
    if (audioContext) return audioContext
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!AudioCtx) {
      return null
    }
    audioContext = new AudioCtx()
    return audioContext
  }

  const ensureWebAudioReady = async () => {
    const ctx = getAudioContext()
    if (!ctx) {
      return false
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return false
      }
    }
    return ctx.state === 'running'
  }

  Object.entries(audioSources).forEach(([key, source]) => {
    if (!key || !source) {
      return
    }
    const audio = new Audio(source)
    audio.preload = 'auto'
    sounds.set(key, audio)
  })

  const unlockAudio = async () => {
    if (!audioEnabled) {
      return false
    }

    let unlocked = false
    if (!mediaUnlocked && sounds.size > 0) {
      const firstAudio = sounds.values().next().value
      if (firstAudio) {
        try {
          firstAudio.muted = true
          firstAudio.currentTime = 0
          await firstAudio.play()
          firstAudio.pause()
          firstAudio.currentTime = 0
          firstAudio.muted = false
          mediaUnlocked = true
          unlocked = true
        } catch {
          // Ignore; Web Audio may still unlock successfully below.
        }
      }
    }

    const webAudioReady = await ensureWebAudioReady()
    return unlocked || mediaUnlocked || webAudioReady
  }

  const playTrainHorn = async ({
    trainNumber = 1,
    baseFrequency = resolvedHornDefaults.baseFrequency,
    duration = resolvedHornDefaults.duration,
    volume = resolvedHornDefaults.volume,
    detune = resolvedHornDefaults.detune
  } = {}) => {
    if (!audioEnabled) {
      return false
    }

    const ctx = getAudioContext()
    if (!ctx) {
      return false
    }

    if (!(await ensureWebAudioReady())) {
      return false
    }

    const safeDuration = Math.min(2.5, Math.max(0.15, Number(duration) || resolvedHornDefaults.duration))
    const safeVolume = Math.min(1, Math.max(0, Number(volume) || resolvedHornDefaults.volume))
    const safeDetune = Math.max(-2400, Math.min(2400, Number(detune) || resolvedHornDefaults.detune))
    const safeTrainNumber = Number.isFinite(trainNumber) ? trainNumber : 1
    const seed = ((Math.abs(Math.trunc(safeTrainNumber)) % 13) - 6)
    const trainPitchFactor = Math.pow(2, seed / 36)
    const fundamental = Math.max(80, Math.min(1200, (Number(baseFrequency) || resolvedHornDefaults.baseFrequency) * trainPitchFactor))

    const now = ctx.currentTime
    const attack = 0.04
    const decay = 0.16
    const release = 0.24
    const hold = Math.max(0, safeDuration - attack - decay - release)

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, safeVolume), now + attack)
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, safeVolume * 0.78), now + attack + decay)
    master.gain.setValueAtTime(Math.max(0.0001, safeVolume * 0.78), now + attack + decay + hold)
    master.gain.exponentialRampToValueAtTime(0.0001, now + safeDuration)

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(fundamental * 2.2, now)
    bandpass.Q.setValueAtTime(0.9, now)

    const osc1 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(fundamental, now)
    osc1.detune.setValueAtTime(safeDetune, now)

    const osc2 = ctx.createOscillator()
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(fundamental * 1.005, now)
    osc2.detune.setValueAtTime(safeDetune + 4, now)

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(5.1, now)

    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(10, now)

    osc1.connect(bandpass)
    osc2.connect(bandpass)
    bandpass.connect(master)
    master.connect(ctx.destination)

    lfo.connect(lfoGain)
    lfoGain.connect(osc1.detune)
    lfoGain.connect(osc2.detune)

    try {
      osc1.start(now)
      osc2.start(now)
      lfo.start(now)
      osc1.stop(now + safeDuration)
      osc2.stop(now + safeDuration)
      lfo.stop(now + safeDuration)
      const cleanupDelay = Math.ceil((safeDuration + 0.05) * 1000)
      setTimeout(() => {
        try {
          osc1.disconnect()
          osc2.disconnect()
          lfo.disconnect()
          lfoGain.disconnect()
          bandpass.disconnect()
          master.disconnect()
        } catch {
          // Ignore cleanup errors for already-disconnected nodes.
        }
      }, cleanupDelay)
      return true
    } catch {
      return false
    }
  }

  const safePlay = async (soundKey, { volume = 1, loop = false, restart = true } = {}) => {
    const audio = sounds.get(soundKey)
    if (!audioEnabled || !audio) {
      return false
    }

    if (!mediaUnlocked) {
      await unlockAudio()
      if (!mediaUnlocked) {
        return false
      }
    }

    try {
      audio.volume = volume
      audio.loop = loop
      if (restart) {
        audio.currentTime = 0
      }
      await audio.play()
      return true
    } catch {
      return false
    }
  }

  const setEnabled = (nextEnabled) => {
    audioEnabled = !!nextEnabled
    if (!audioEnabled) {
      sounds.forEach((audio) => {
        try {
          audio.pause()
          audio.currentTime = 0
        } catch {
          // Ignore media state errors while force-stopping sounds.
        }
      })
    }
    return audioEnabled
  }

  const toggleSound = (forceEnabled) => {
    const nextEnabled = typeof forceEnabled === 'boolean'
      ? forceEnabled
      : !audioEnabled
    return setEnabled(nextEnabled)
  }

  return {
    unlockAudio,
    safePlay,
    playTrainHorn,
    setEnabled,
    toggleSound,
    isEnabled: () => audioEnabled,
    isUnlocked: () => {
      const webAudioRunning = !!audioContext && audioContext.state === 'running'
      return mediaUnlocked || webAudioRunning
    },
    getAudio: (soundKey) => sounds.get(soundKey) ?? null
  }
}

export {
  makeDraggable,
  ck,
  rowAndColumnName,
  alpha,
  getDetailedSegmentsMap,
  getCommonSegmentsMap,
  createAudioManager,
  delay
}