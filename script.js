import { Train } from './Train.js'
import { Track } from './Track.js'
import { Tracks } from './Tracks.js'
import { Game } from './Game.js'
import { Intersections } from './Intersections.js'

const CANVASHEIGHT = 840
const CANVASWIDTH = 1240
const OFFSET_X = 20
const OFFSET_Y = 20
const gridSize = 100

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

// canvas.height = CANVASHEIGHT
// canvas.width = CANVASWIDTH

const canvasTracks = document.querySelector('#canvas_tracks')
const ctxTracks = canvasTracks.getContext('2d')

const canvasTemp = document.querySelector('#canvas_temp')
const ctxTemp = canvasTemp.getContext('2d')

canvas.height = canvasTracks.height = canvasTemp.height = CANVASHEIGHT
canvas.width = canvasTracks.width = canvasTemp.width = CANVASWIDTH

let paused = true
let startTrack = false
let click_error = 20
let intersections = new Intersections(CANVASWIDTH - OFFSET_X * 2, CANVASHEIGHT - OFFSET_Y * 2, gridSize)

const game = new Game()

let tracks = new Tracks(ctxTracks)
let track = new Track(ctxTracks,
  [
    { x: OFFSET_X + 0, y: OFFSET_Y + 0 },
    { x: OFFSET_X + 400, y: OFFSET_Y + 0 },
    { x: OFFSET_X + 400, y: OFFSET_Y + 800 },
    { x: OFFSET_X + 0, y: OFFSET_Y + 800 },
    { x: OFFSET_X + 0, y: OFFSET_Y + 0 },
  ], 'Bullet Train'

)
game.addTrain(new Train(ctx, ctxTemp, 10, track, 'rgba(212,0,212,0.5)', 10, 'Bullet Train', 0, 4, intersections))

track = new Track(ctxTracks,
  [
    { x: 800, y: 200 },
    { x: 500, y: 200 },
    { x: 500, y: 500 },
    { x: 1100, y: 500 },
    { x: 1100, y: 700 },
    { x: 800, y: 700 },
    { x: 800, y: 200 },
  ], 'Express Train'

)
game.addTrain(new Train(ctx, ctxTemp, 7, track, 'rgba(212,0,212,0.5)', 5 , 'Express Train',0,2,intersections))

const drawScene = () => {
  if (!paused) {
    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    game.draw()
    requestAnimationFrame(drawScene)
  }
}
drawScene()

window.addEventListener('load', () => {
  const startPausebutton = document.querySelector('#startPauseBtn')
  let acceptableNextPositions = []
  let positions = []
  startPausebutton.addEventListener('click', () => {
    paused = !paused
    drawScene()
  })
  document.querySelector('#canvas_temp').addEventListener('click', (event) => {
    if (startTrack) {
      const x = Math.round(event.pageX / 100) * 100
      const y = Math.round(event.pageY / 100) * 100
      if (Math.abs(x - event.pageX) < click_error && Math.abs(y - event.pageY) < click_error) {
        positions.push({ x, y })
        updateCanvasTemp(x, y)
      }
    }
  })
  document.querySelector('#canvas_temp').addEventListener('mousemove', (event) => {
    //console.log(`mouse move event listener added`)
    if (startTrack) {
      //console.log(`mouse movin inside startTrack`)
      const x = Math.round(event.pageX / 100) * 100
      const y = Math.round(event.pageY / 100) * 100
      if (Math.abs(x - event.pageX) < click_error && Math.abs(y - event.pageY) < click_error) {
        event.target.style = "cursor:pointer"
      } else {
        event.target.style = "cursor:default"
      }
    }
  })

  document.querySelector('#startTrack').addEventListener('click', () => {
    startTrack = true
    document.querySelector('#canvas_temp').style = 'cursor:crosshair'
    //console.log(`Start Track Button clicked`)
  })
  document.querySelector('#endTrack').addEventListener('click', () => {
    ctxTemp.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    if (startTrack) {
      startTrack = false
      document.querySelector('#canvas').style = 'cursor:default'
      const track = new Track(ctxTracks, positions)
      tracks.add(track)
      tracks.draw()
      let speed = Math.ceil(Math.random() * 10)
      game.addTrain(new Train(ctx, ctxTemp, speed, track, 'rgb(0,255,100)', 5, 'SuperFast', 0, game.trains.length + 1, intersections))
      positions = []
      ctxTemp.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    }
  })

  //set up the grid
  drawGrid(ctxTracks)
  function updateCanvasTemp() {
    ctxTemp.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    //for each of the positions draw a small circle on ctxTemp
    positions.forEach(position => {
      const { x, y } = position
      ctxTemp.save()
      ctxTemp.beginPath()
      ctxTemp.moveTo(x, y)
      ctxTemp.fillStyle = 'red'
      ctxTemp.arc(x, y, 5, 0, Math.PI * 2)
      ctxTemp.closePath()
      ctxTemp.fill()
      ctxTemp.restore()
    })

    //mark all points in the same row and column as the last position with a light green
    const { x: last_x, y: last_y } = positions[positions.length - 1]
    for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
      if (row != last_y / gridSize) {
        //drawCircle
        ctxTemp.beginPath()
        ctxTemp.moveTo(last_x + click_error, row * gridSize)
        ctxTemp.arc(last_x, row * gridSize, click_error, 0, Math.PI * 2)
        ctxTemp.strokeStyle = `rgba(0,255,0,0.3)`
        ctxTemp.closePath()
        ctxTemp.stroke()
      }
    }
    for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
      if (col != last_x / gridSize) {
        //drawCircle
        ctxTemp.beginPath()
        ctxTemp.moveTo(col * gridSize + click_error, last_y)
        ctxTemp.arc(col * gridSize, last_y, click_error, 0, Math.PI * 2)
        ctxTemp.strokeStyle = `rgba(0,255,0,0.3)`
        ctxTemp.closePath()
        ctxTemp.stroke()
      }
    }
  }
  //add event listener for stopping the train so that there is no accident
  window.addEventListener('keydown', (event) => {
    game.startStopTrain(event.key)
  })
  for (let but = 0; but < 9; but++) {
    document.querySelector(`#butTrain${but + 1}`).addEventListener('click', (event) => {
      if (game.trains.length > but) {
        game.startStopTrain(but + 1)
      }
    })
  }
  //add event listener for my custom events
  // window.addEventListener('crossingintersection',(event)=>{
  //   // console.log(`Crossing: ${event.gridRow},${event.gridCol},${event.trainNumber}`)
  //   intersections.updateIntersection(event.gridRow,event.gridCol,event.trainNumber)
  // })
  // //add event listener for my custom events
  // window.addEventListener('clearedintersection',(event)=>{
  //   // console.log(`Cleared: ${event.gridRow},${event.gridCol},${event.trainNumber}`)
  //   intersections.updateIntersection(event.gridRow,event.gridCol,null)
  // })
  window.addEventListener('collision', (event) => {
    console.log(`Collision between train ${event.train1} and train ${event.train2}`)
    displayCollision(event.col, event.row)
  })
})

function displayCollision(col, row) {
  ctxTemp.beginPath()
  ctxTemp.fillStyle = 'rgba(255,0,0,0.5)'
  ctxTemp.moveTo(col * 100, row * 100)
  ctxTemp.arc(col * 100, row * 100, 50, 0, Math.PI * 2)
  ctxTemp.fill()
}
function drawGrid(ctx) {
  const numCols = (CANVASWIDTH - 2 * OFFSET_X) / gridSize
  const numRows = (CANVASHEIGHT - 2 * OFFSET_Y) / gridSize
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.beginPath()

  for (let i = 0; i <= numCols; i++) {
    ctx.moveTo(OFFSET_X + i * gridSize, OFFSET_Y)
    ctx.lineTo(OFFSET_X + i * gridSize, CANVASHEIGHT - OFFSET_Y)
  }
  for (let j = 0; j <= numRows; j++) {
    ctx.moveTo(OFFSET_X + 0, OFFSET_Y + j * gridSize)
    ctx.lineTo(CANVASWIDTH - OFFSET_X, OFFSET_Y + j * gridSize)
  }
  ctx.closePath()
  ctx.stroke()
}

