import { Train } from './Train.js'
import { Track } from './Track.js'
import { Tracks } from './Tracks.js'
import { Financials } from './Financials.js'
import { Flyovers } from './Flyovers.js'
import { Flyover } from './Flyover.js'
class Game {
  TRAINCOLORS = ['rgba(255,0,0,0.5)',
    'rgba(125,0,255,0.5)',
    'rgba(0,0,255,0.5)',
    'rgba(255,255,0,0.5)',
    'rgba(255,0,255,0.5)',
    'rgba(0,255,255,0.5)']

  constructor(ctx, ctxTracks, ctxTemp, gridSize, OFFSET_X, OFFSET_Y) {
    this.ctx = ctx
    this.ctxTracks = ctxTracks
    this.ctxTemp = ctxTemp
    this.gridSize = gridSize
    this.OFFSET_X = OFFSET_X
    this.OFFSET_Y = OFFSET_Y
    this.trains = []
    this.stations = new Flyovers(ctxTracks, gridSize, OFFSET_X, OFFSET_Y)
    this.tracks = new Tracks(ctxTracks)
    this.ticksPerTimeUnit = 10000
    this.totalTimeUnits = 100
    this.financials = new Financials(this.totalTimeUnits)
    // this.intersections = intersections
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

  setPossibleStationLocations(locations){
    this.stations.setPossibleStationLocations(locations)
  }

  addStation(name, row, col) {
    const station = new Flyover(name, row, col)
    this.stations.addStation(station)
  }

  getNumberOfStations(){
    return this.stations.getAllStations().length
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
    const track = new Track(this.ctxTracks, positions)
    this.addTrack(track)
    const color = this.TRAINCOLORS[(trainNumber - 1) % this.TRAINCOLORS.length]
    const train = new Train(this.ctx, this.ctxTemp, engineSpeed, track, color, numCoaches, trainName, delayBeforeStart, trainNumber, intersections, this.financials, () => this.getCurrentTimeIndex())
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
      this.stations.draw()
    }
  }
}
export {
  Game
}