import { Train } from './Train.js'
import { Track } from './Track.js'
import { Tracks } from './Tracks.js'
import { Financials } from './Financials.js'
import { Flyovers } from './Flyovers.js'
import { Flyover } from './Flyover.js'
import { createStation } from './Station.js'
import { Intersections } from './Intersections.js'
import { Population } from './Population.js'
import { TravelPopulation} from './TravelPopulation.js'
class Game {

  TRAINCONFIG = [
    { defaultName: 'Red', Color: 'rgba(255,0,0,0.5)' },
    { defaultName: 'Violet', Color: 'rgba(125,0,255,0.5)' },
    { defaultName: 'Blue', Color: 'rgba(0,0,255,0.5)' },
    { defaultName: 'Yellow', Color: 'rgba(255,255,0,0.5)' },
    { defaultName: 'Magenta', Color: 'rgba(255,0,255,0.5)' },
    { defaultName: 'Cyan', Color: 'rgba(0,255,255,0.5)' }
  ]

  constructor(ctx, ctxTracks, ctxTemp, gridSize, OFFSET_X, OFFSET_Y) {
    this.ctx = ctx
    this.ctxTracks = ctxTracks
    this.ctxTemp = ctxTemp
    this.gridSize = gridSize
    this.OFFSET_X = OFFSET_X
    this.OFFSET_Y = OFFSET_Y
    this.trains = []
    this.Flyovers = new Flyovers(ctxTracks, gridSize, OFFSET_X, OFFSET_Y)
    this.tracks = new Tracks(ctxTracks)
    this.ticksPerTimeUnit = 10000
    this.totalTimeUnits = 100
    this.financials = new Financials(this.totalTimeUnits)
    // this.intersections = intersections
    this.population = new Population(ctx.canvas.width, ctx.canvas.height, gridSize)
    this.travelPopulation = new TravelPopulation(this.population, ctx.canvas.width, ctx.canvas.height, gridSize)
    //log population to check the values
    console.log(this.population)
    console.log(this.travelPopulation)
  }
  
  getCurrentTimePeriod() {
    return Math.min(Math.floor(globalThis.globalTicks / this.ticksPerTimeUnit), this.totalTimeUnits - 1)
  }

  getCurrentTimeIndex() {
    return this.getCurrentTimePeriod()
  }

  addCoach(trainNumber) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      train.addCoach()
    }
  }

  removeCoach(trainNumber) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      train.removeCoach()
    }
  }

  incrementCollisionCost(ticks, train1, train2) {
    this.financials.incrementCollisionCost(this.getCurrentTimeIndex(), train1, train2)
  }

  getFinancialSummary(ticks) {
    return this.financials.getFinancialSummary(this.getCurrentTimeIndex())
  }

  getFinancialSummaryByTrain(ticks) {
    return this.financials.getFinancialSummaryByTrain(this.getCurrentTimeIndex())
  }

  addTrack(track) {
    this.tracks.add(track)
  }

  setPossibleFlyoverLocations(locations){
    this.Flyovers.setPossibleFlyoverLocations(locations)
  }

  addFlyover(name, row, col) {
    const flyover = new Flyover(name, row, col)
    this.Flyovers.addFlyover(flyover)
  }

  getNumberOfFlyovers(){
    return this.Flyovers.getAllFlyovers().length
  }

  addTrain( positions, engineSpeed,  numCoaches, trainName, delayBeforeStart, intersections) {

    // if there is a train that is removed and has null value in the trains array, we can reuse that train slot for the new train. This way we can keep the train number consistent and avoid issues with train numbers changing after a train is removed.
    const nullIndex = this.trains.findIndex(train => train === null)
    let trainNumber;
    if (nullIndex !== -1) {
      trainNumber = nullIndex + 1
    } else {
      trainNumber = this.trains.length + 1
    }
    const stations = []
    const stationType = numCoaches <= 5 ? 'small' : numCoaches <= 10 ? 'medium' : 'large'
    const firstPosition = positions[0]
    const lastPosition = positions[positions.length - 1]
    if(firstPosition.x == lastPosition.x && firstPosition.y == lastPosition.y){
      // if the first and the last position are same, then we can add a small station at the first position only
      stations.push(createStation(this.ctxTracks, firstPosition.x, firstPosition.y, this.gridSize, 0,trainNumber, `${trainName}-S`, 30, false, stationType))
      intersections.updateIntersectionsWithStationLocation(firstPosition.y/this.gridSize, firstPosition.x/this.gridSize, 'Station')
      this.financials.addStation(this.getCurrentTimeIndex(), trainNumber, stationType)
    } else{
      //we add small stations at both starting and ending points
      stations.push(createStation(this.ctxTracks, firstPosition.x, firstPosition.y, this.gridSize, 0,trainNumber, `${trainName}-S`, 30, false, stationType))
      stations.push(createStation(this.ctxTracks, lastPosition.x, lastPosition.y, this.gridSize, 0, trainNumber, `${trainName}-E`, 30, false, stationType))
      intersections.updateIntersectionsWithStationLocation(firstPosition.y/this.gridSize, firstPosition.x/this.gridSize, 'Station')
      intersections.updateIntersectionsWithStationLocation(lastPosition.y/this.gridSize, lastPosition.x/this.gridSize, 'Station')
      this.financials.addStation(this.getCurrentTimeIndex(), trainNumber, stationType)
      this.financials.addStation(this.getCurrentTimeIndex(), trainNumber, stationType)
    }
    const track = new Track(this.ctxTracks, positions,trainName,this.gridSize, stations)
    this.addTrack(track)
    const colorConfig = this.TRAINCONFIG[(trainNumber - 1) % this.TRAINCONFIG.length]
    const color = colorConfig.Color
    const train = new Train(this.ctx, this.ctxTemp, engineSpeed, track, color, numCoaches, trainName, delayBeforeStart, trainNumber, intersections, this.financials, this.travelPopulation, () => this.getCurrentTimeIndex())
    const length = track.getTotalLength()
    const currentTimeIndex = this.getCurrentTimeIndex()
    this.financials.incrementTrackCost(currentTimeIndex, trainNumber, length)
    this.financials.buyEngine(currentTimeIndex, trainNumber)
    this.financials.buyCoach(currentTimeIndex, trainNumber, numCoaches)
    this.trains[trainNumber - 1] = train
    const trainElement = document.querySelector(`#train${trainNumber}`)
    if (trainElement) {
      if(nullIndex !== -1){
        trainElement.style.filter = "none"
      } else{
      trainElement.style.display = 'flex'
      }
      trainElement.style.backgroundColor = color
    }
  }
  startStopTrain(trainNumber) {
    if (trainNumber <= this.trains.length) {
      const el= document.querySelector(`#pauseTrain${trainNumber}`)
      if(el){
        el.classList.toggle('fa-pause')
        el.classList.toggle('fa-play')
      }
      const train = this.trains[trainNumber - 1]
      train.startStop()
    }
  }
  draw() {
    this.trains.forEach((train, index) => {
      if(train){
        train.draw()
      }
    })
    // this.checkForCollissions()
  }
  increaseTrainSpeed(trainNumber) {
    if (trainNumber <= this.trains.length) {
      this.trains[trainNumber - 1].speedUp()
    }
  }
  decreaseTrainSpeed(trainNumber) {
    if (trainNumber <= this.trains.length) {
      this.trains[trainNumber - 1].slowDown()
    }
  }
  removeTrain(trainNumber) {
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1]
      train.startStop()
      // instead of removing the train from the array, we can set the null value for the train in the array. 
      // This way we can keep the train number consistent and avoid issues with train numbers changing after a train is removed.
      this.trains[trainNumber - 1] = null
      // we remove the track for the deleted train. We do this by
      // redrawing the tracks only for the remaining trains. This is a simple way to remove the track of the deleted train without having to implement a more complex track management system.
      this.trains.forEach(train => {
          if(train){  
            train.track.drawUsingNewPositions()
          }
      })
      const trainElement = document.querySelector(`#train${trainNumber}`)
      if (trainElement) {
        trainElement.style.filter = "blur(5px)"
      }
      this.Flyovers.draw()
    }
  }
}
export {
  Game
}