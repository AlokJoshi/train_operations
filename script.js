import { Train } from './Train.js'
import { Track } from './Track.js'
import { Tracks } from './Tracks.js'
import { Game } from './Game.js'

const canvasHeight = 800
const canvasWidth = 1200
const gridSize = 100

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

canvas.height = canvasHeight
canvas.width = canvasWidth

const canvasTracks = document.querySelector('#canvas_tracks')
const ctxTracks = canvasTracks.getContext('2d')

const canvasTemp = document.querySelector('#canvas_temp')
const ctxTemp = canvasTemp.getContext('2d')

canvas.height = canvasTracks.height = canvasTemp.height = canvasHeight
canvas.width = canvasTracks.width = canvasTemp.width = canvasWidth

let paused = false
let startTrack = false
let click_error = 20

const game = new Game(ctx, ctxTracks)

let tracks = new Tracks(ctxTracks)
const track = new Track(ctxTracks,
  //this works
  // [
  // { x: 0, y: 0 },
  // { x: 500, y: 300 },
  // { x: 400, y: 400 },
  // { x: 100, y: 400 },
  // { x: 0, y: 0 }
  // ]
  [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 0 },
    // { x: 150, y: 100 },
    // { x: 150, y: 150 },
    // { x: 150, y: 200 },
    // { x: 100, y: 200 },
    // { x: 0, y: 0 }
  ]

)
game.addEngine(new Train(ctx, 2, track, 'rgba(212,0,212,0.5)'))

const drawScene = () => {
  if (!paused) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    game.draw()
    requestAnimationFrame(drawScene)
  }
}
drawScene()

window.addEventListener('load', () => {
  const startPausebutton = document.querySelector('#startPauseBtn')
  let positions = []
  startPausebutton.addEventListener('click', () => {
    paused = !paused
    drawScene()
  })
  document.querySelector('#canvas').addEventListener('click', (event) => {
    if (startTrack) {
      const x = Math.round(event.x / 100) * 100
      const y = Math.round(event.y / 100) * 100
      if (Math.abs(x - event.x) < click_error && Math.abs(y - event.y) < click_error) {
        positions.push({ x, y })
        updateCanvasTemp(x,y)
        
      }
    }
  })
  document.querySelector('#canvas').addEventListener('mousemove', (event) => {
    if (startTrack) {
      const x = Math.round(event.x / 100) * 100
      const y = Math.round(event.y / 100) * 100
      if (Math.abs(x - event.x) < click_error && Math.abs(y - event.y) < click_error) {
        event.target.style="cursor:pointer"
      }else{
        event.target.style="cursor:default"
      }
    }
  })

  document.querySelector('#startTrack').addEventListener('click', () => {
    startTrack = true
    document.querySelector('#canvas').style = 'cursor:crosshair'
  })
  document.querySelector('#endTrack').addEventListener('click', () => {
    ctxTemp.clearRect(0,0,canvasWidth,canvasHeight)
    if (startTrack) {
      startTrack = false
      document.querySelector('#canvas').style = 'cursor:default'
      const track = new Track(ctxTracks, positions)
      tracks.add(track)
      tracks.draw()
      let speed = Math.ceil(Math.random() * 5)
      game.addEngine(new Train(ctx, speed, track, 'rgb(0,255,100'))
      positions = []
      ctxTemp.clearRect(0,0,canvasWidth,canvasHeight)
    }
  })

  //set up the grid
  drawGrid(ctxTracks)
  function updateCanvasTemp(){
    ctxTemp.clearRect(0,0,canvasWidth,canvasHeight)
    //for each of the positions draw a small circle on ctxTemp
    positions.forEach(position=>{
      const {x,y}=position
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
  const {x:last_x,y:last_y} = positions[positions.length-1]
  for(let row = 0; row<canvasHeight/gridSize;row++){
    if(row!=last_y/gridSize){
      //drawCircle
      ctxTemp.beginPath()
      ctxTemp.moveTo(last_x+click_error,row*gridSize)
      ctxTemp.arc(last_x,row*gridSize,click_error,0,Math.PI*2)
      ctxTemp.strokeStyle=`rgba(0,255,0,0.3)`
      ctxTemp.closePath()
      ctxTemp.stroke()
    }
  }
  for(let col = 0; col<canvasWidth/gridSize;col++){
    if(col!=last_x/gridSize){
      //drawCircle
      ctxTemp.beginPath()
      ctxTemp.moveTo(col*gridSize+click_error,last_y)
      ctxTemp.arc(col*gridSize,last_y,click_error,0,Math.PI*2)
      ctxTemp.strokeStyle=`rgba(0,255,0,0.3)`
      ctxTemp.closePath()
      ctxTemp.stroke()
    }
  }
  }
})

function drawGrid(ctx) {
  const numCols = 1200 / gridSize
  const numRows = 800 / gridSize
  ctx.strokeStyle = 'rgba(50,0,0,0.2)'
  ctx.beginPath()

  for (let i = 0; i < numCols; i++) {
    ctx.moveTo(i * gridSize, 0)
    ctx.lineTo(i * gridSize, 800)
  }
  for (let j = 0; j < numRows; j++) {
    ctx.moveTo(0, j * gridSize)
    ctx.lineTo(1200, j * gridSize)
  }
  ctx.closePath()
  ctx.stroke()
}

