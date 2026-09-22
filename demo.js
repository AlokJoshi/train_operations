import {
  delay,
  convertFromCanvasToClientCoordinates,
  animateMouseFromCenterToElement,
  animateMouseFromStartToEndCoordinates,
  speakAsync
} from './utility.js'

export function createDemoController(options) {
  const {
    CANVASWIDTH,
    CANVASHEIGHT,
    ctxTracks,
    ctxDemoTracks,
    ctxTrains,
    getPaused,
    setPaused,
    getRunningScriptedDemo,
    setRunningScriptedDemo,
    getGame,
    sendHotkey,
    removeTrain,
    overlayMessage = 'Demo in progress: Turn on sound to hear the commentary. Also keyboard and mouse input are temporarily disabled.'
  } = options

  const dismissVisibleSwal = async ({ requireConfirm = false, waitForVisibleMs = 1500, pollIntervalMs = 50 } = {}) => {
    if (typeof window.swal === 'undefined') {
      return false
    }

    const hasVisibilityApi = typeof window.swal.isVisible === 'function'
    if (hasVisibilityApi) {
      const maxChecks = Math.max(1, Math.floor(waitForVisibleMs / pollIntervalMs))
      let checks = 0
      while (!window.swal.isVisible() && checks < maxChecks) {
        await delay(pollIntervalMs)
        checks++
      }
      if (!window.swal.isVisible()) {
        return false
      }
    }

    if (typeof window.swal.clickConfirm === 'function') {
      window.swal.clickConfirm()
      return true
    }

    if (requireConfirm) {
      return false
    }

    if (typeof window.swal.close === 'function') {
      window.swal.close()
      return true
    }

    return false
  }

  const shouldBlockUserInputDuringDemo = (event) => getRunningScriptedDemo() && event?.isTrusted === true

  const blockUserInputDuringDemo = (event) => {
    if (!shouldBlockUserInputDuringDemo(event)) {
      return
    }
    if (event.cancelable) {
      event.preventDefault()
    }
    event.stopImmediatePropagation()
  }

  const blockedEventsDuringDemo = [
    'keydown',
    'keyup',
    'keypress',
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'contextmenu',
    'pointerdown',
    'pointerup',
    'pointermove',
    'wheel',
    'touchstart',
    'touchmove',
    'touchend'
  ]

  blockedEventsDuringDemo.forEach((eventName) => {
    window.addEventListener(eventName, blockUserInputDuringDemo, true)
  })

  const demoInputLockOverlayId = 'demoInputLockOverlay'

  const showDemoInputLockOverlay = () => {
    let overlayEl = document.getElementById(demoInputLockOverlayId)
    if (!overlayEl) {
      overlayEl = document.createElement('div')
      overlayEl.id = demoInputLockOverlayId
      overlayEl.style.position = 'fixed'
      overlayEl.style.top = '100px'
      overlayEl.style.left = '50%'
      overlayEl.style.transform = 'translateX(-50%)'
      overlayEl.style.padding = '10px 16px'
      overlayEl.style.background = 'rgba(245, 226, 10, 0.25)'
      overlayEl.style.color = '#fff'
      overlayEl.style.fontSize = '14px'
      overlayEl.style.fontWeight = '600'
      overlayEl.style.borderRadius = '8px'
      overlayEl.style.zIndex = '10001'
      overlayEl.style.pointerEvents = 'none'
      overlayEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
      overlayEl.textContent = overlayMessage
      document.body.appendChild(overlayEl)
    }
    overlayEl.style.display = 'block'
  }

  const hideDemoInputLockOverlay = () => {
    const overlayEl = document.getElementById(demoInputLockOverlayId)
    if (overlayEl) {
      overlayEl.style.display = 'none'
    }
  }

  const startScriptedDemoToAddTrainAndStation = async (points, stationPoints, delayMS = 3000, deleteTrain = true) => {
    let gameWasRunning = false
    setRunningScriptedDemo(true)
    showDemoInputLockOverlay()

    try {
      ctxDemoTracks.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
      ctxTracks.canvas.style.display = 'none'
      ctxTrains.canvas.style.display = 'none'
      ctxDemoTracks.canvas.style.display = 'block'

      document.getElementById('buttonGroup1').style.display = 'none'
      document.getElementById('buttonGroup2').style.display = 'none'
      document.getElementById('buttonGroup3').style.display = 'none'
      document.getElementById('buttonGroup4').style.display = 'none'
      document.getElementById('buttonGroup5').style.display = 'none'
      document.getElementById('buttonGroup7').style.display = 'none'

      await delay(1000)
      gameWasRunning = !getPaused()
      if (gameWasRunning) {
        setPaused(true)
      }

      await speakAsync('This demo will guide you through adding a train and a few stations.')

      await delay(delayMS)
      await speakAsync('Press on the T key on your keyboard or click on the Train button (T) on the on-screen control panel to bring up the Train dialog box.')

      await delay(delayMS)
      sendHotkey('T')

      await speakAsync('Now click on the Start Track Spec. play button.')

      await delay(delayMS)

      const startNewTrainPlayBtn = document.querySelector('#startTrack')
      if (startNewTrainPlayBtn instanceof HTMLElement) {
        let didAnimate = await animateMouseFromCenterToElement(startNewTrainPlayBtn)
        if (!didAnimate || !getRunningScriptedDemo()) {
          console.error('Failed to animate mouse to the Start Track Spec. play button or the scripted demo is no longer running.')
          return
        }
        startNewTrainPlayBtn.click()

        await speakAsync('This brings up an instructional message on the process that you must follow. You will read it and then click on OK')
        await delay(delayMS)

        await dismissVisibleSwal({ requireConfirm: true })

        await speakAsync('Now click on the starting point from where you want the train to begin.')

        await delay(delayMS)

        const canvasTempEl = document.querySelector('#canvas_temp')
        const targetRect = startNewTrainPlayBtn.getBoundingClientRect()
        const playLeft = targetRect.left
        const playTop = targetRect.top

        let { clientX: startX, clientY: startY } = convertFromCanvasToClientCoordinates(canvasTempEl, playLeft, playTop)

        let clientPoint = {}
        let didAnimateToCoordinates = false
        for (let i = 0; i < points.length; i++) {
          await speakAsync('Click on the ' + (i == 0 ? 'starting' : 'next') + ' point of the route.')

          clientPoint = convertFromCanvasToClientCoordinates(canvasTempEl, points[i].x, points[i].y)
          didAnimateToCoordinates = await animateMouseFromStartToEndCoordinates(startX, startY, clientPoint.clientX, clientPoint.clientY)

          if (!didAnimateToCoordinates) {
            console.error('Failed to animate mouse to the specified coordinates')
            return false
          }
          const clickEvent = new MouseEvent('click', { clientX: clientPoint.clientX, clientY: clientPoint.clientY, bubbles: true, cancelable: true })
          canvasTempEl.dispatchEvent(clickEvent)

          await delay(delayMS)
          startX = clientPoint.clientX
          startY = clientPoint.clientY
        }

        await delay(delayMS)
        await speakAsync('You can continue adding points to the route. However, let us assume that you have finished adding all the points and that it time to finalize the route and flag-off the train.')

        await delay(delayMS)

        await speakAsync('Select the type of train - passenger or freight and the number of coaches or wagons and then click on the flag-off icon to start the train.')

        await delay(delayMS)

        const flagOffBtn = document.querySelector('#flagOff')
        const flagOffBtnRect = flagOffBtn.getBoundingClientRect()
        const { clientX: endX4, clientY: endY4 } = convertFromCanvasToClientCoordinates(canvasTempEl, flagOffBtnRect.left, flagOffBtnRect.top)
        didAnimateToCoordinates = await animateMouseFromStartToEndCoordinates(startX, startY, endX4, endY4)
        if (!didAnimateToCoordinates || !getRunningScriptedDemo()) {
          console.error('Failed to animate mouse to flag-off button or the scripted demo is no longer running.')
          return
        }
        flagOffBtn.click()
        const messages = []
        messages.push('In the actual game you will see the train moving along the route you specified unless the game is in a paused state.')
        await delay(delayMS)
        for (const message of messages) {
          await speakAsync(message)
          await delay(delayMS)
        }

        const lastTrainNumber = getGame().trains.length
        await speakAsync('Once you create a train, starting and ending stations are defined. But you can then add a station.')

        await delay(delayMS)

        await speakAsync('First step is to bring up the Stations dialog box by pressing the S key on your keyboard or by clicking on the S button in the green on-screen control panel.')

        await delay(delayMS)

        sendHotkey('S')

        await delay(delayMS)

        await speakAsync(`Since the train that you added is train number ${lastTrainNumber}, you should now see it listed in the Station Dialog box. You will click on the T${lastTrainNumber} entry to view all the points where a station can be added.`)
        await delay(delayMS)

        const stationContainer = document.querySelector('#stationFortrain')
        if (!stationContainer) {
          console.error('Station container not found')
          return
        }
        const stationElement = document.querySelector(`[data-value="${lastTrainNumber}"][data-role="station-train"]`)
        if (!stationElement) {
          console.error(`Station element for train number ${lastTrainNumber} not found`)
          return
        }

        didAnimate = await animateMouseFromCenterToElement(stationElement)
        if (!didAnimate || !getRunningScriptedDemo()) {
          console.error(`Failed to animate mouse to station element for train number ${lastTrainNumber} or the scripted demo is no longer running.`)
        }

        stationElement.click()

        await speakAsync('Now you can click on any of the green circles to add a new station at that location.')
        await speakAsync('You will be asked to confirm the addition of the new station. During this demo, it is assumed that you are confirming the addition of the station.')
        await speakAsync('You can repeat this process to add multiple stations.')
        await delay(delayMS)

        for (let i = 0; i < stationPoints.length; i++) {
          await speakAsync('Click on ' + (i == 0 ? 'first' : 'next') + 'point where you want to add a station.')

          clientPoint = convertFromCanvasToClientCoordinates(canvasTempEl, stationPoints[i].x, stationPoints[i].y)
          didAnimateToCoordinates = await animateMouseFromStartToEndCoordinates(startX, startY, clientPoint.clientX, clientPoint.clientY)

          if (!didAnimateToCoordinates) {
            console.error('Failed to animate mouse to the specified coordinates')
            return false
          }

          const clickEvent = new MouseEvent('click', { clientX: clientPoint.clientX, clientY: clientPoint.clientY, bubbles: true, cancelable: true })
          canvasTempEl.dispatchEvent(clickEvent)

          await delay(3000)
          await dismissVisibleSwal({ requireConfirm: true })

          await delay(delayMS)
          startX = clientPoint.clientX
          startY = clientPoint.clientY
        }
        await delay(delayMS)
        await speakAsync(`After adding the new stations, you can click again on T${lastTrainNumber} entry to turn-off the list of possible station locations.`)

        await speakAsync('This concludes the demo.')

        stationElement.click()

        if (!deleteTrain) {
          return lastTrainNumber
        }

        removeTrain(lastTrainNumber)

        await delay(delayMS)
      }
    } finally {
      if (gameWasRunning) {
        setPaused(false)
      }
      ctxTracks.canvas.style.display = 'block'
      ctxTrains.canvas.style.display = 'block'
      ctxDemoTracks.canvas.style.display = 'none'
      setRunningScriptedDemo(false)
      hideDemoInputLockOverlay()
    }
  }

  return {
    startScriptedDemoToAddTrainAndStation
  }
}
