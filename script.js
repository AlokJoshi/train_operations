import { Engine } from './Engine.js'
import { Track } from './Track.js'
import { Tracks} from './Tracks.js'
import { Game} from './Game.js'


// console.log('Working')
const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')
const canvasHeight = 800
const canvasWidth = 1200

canvas.height = canvasHeight
canvas.width = canvasWidth

const canvasTracks = document.querySelector('#canvas_tracks')
const ctxTracks = canvasTracks.getContext('2d')


canvas.height = canvasHeight
canvas.width = canvasWidth
canvasTracks.height = canvasHeight
canvasTracks.width = canvasWidth

let paused = false
let startTrack = false
let click_error = 30

const game = new Game(ctx,ctxTracks)

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
  { x: 50, y: 0 },
  { x: 50, y: 50 },
  { x: 100, y: 50 },
  { x: 100, y: 100 },
  { x: 150, y: 100 },
  { x: 150, y: 150 },
  { x: 150, y: 200 },
  { x: 100, y: 200 },
  { x: 0, y: 0 }
]

)
game.addEngine(new Engine(ctx, 2, track, 'rgba(212,0,212,0.5)'))

const drawScene = () => {
  if(!paused){
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    game.draw()
    requestAnimationFrame(drawScene)
  }
}
drawScene()

window.addEventListener('load',()=>{
  const startPausebutton=document.querySelector('#startPauseBtn')
  let positions = []
  startPausebutton.addEventListener('click',()=>{
    paused = !paused
    drawScene() 
  })
  document.querySelector('#canvas').addEventListener('click',(event)=>{
    if(startTrack){
      const x = Math.round(event.x/100)*100
      const y = Math.round(event.y/100)*100
      if(Math.abs(x-event.x)<click_error && Math.abs(y-event.y)<click_error){
        positions.push({x,y})
        console.log(x,y)
        //draw a small circle on ctxTracks
        ctxTracks.save()
        ctxTracks.beginPath()
        ctxTracks.moveTo(x,y)
        ctxTracks.fillStyle='red'
        ctxTracks.arc(x,y,5,0,Math.PI*2)
        ctxTracks.closePath()
        ctxTracks.fill()
        ctxTracks.restore()
      }
    }
    

  })
  document.querySelector('#startTrack').addEventListener('click',()=>{
    startTrack = true
    document.querySelector('#canvas').style='cursor:crosshair'
  })
  document.querySelector('#endTrack').addEventListener('click',()=>{
    if(startTrack){
      startTrack=false
      document.querySelector('#canvas').style='cursor:default'
      const track = new Track(ctxTracks,positions)
      tracks.add(track)
      tracks.draw()
      let speed = Math.ceil(Math.random()*5)
      game.addEngine(new Engine(ctx,speed,track,'rgb(0,255,100'))
      positions = []
    }
  })

  //set up the grid
  drawGrid(ctxTracks)
})

function drawGrid(ctx){
  const gridSize = 100
  const numCols = 1200/gridSize
  const numRows = 800/gridSize
  ctx.strokeStyle='rgba(50,0,0,0.2)'
  ctx.beginPath()
  
  for(let i=0;i<numCols;i++){
    ctx.moveTo(i*gridSize,0)
    ctx.lineTo( i*gridSize,800)
  }
  for(let j=0;j<numRows;j++){
    ctx.moveTo(0,j*gridSize)
    ctx.lineTo( 1200,j*gridSize)
  }
  ctx.closePath()
  ctx.stroke()  
}

