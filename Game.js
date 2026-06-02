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
import { Rawmaterials } from './Rawmaterials.js'
import { RawmaterialDemand } from './RawmaterialDemand.js'
import { RawMaterialSupply } from './RawMaterialSupply.js'

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
    this.rawmaterials = new Rawmaterials(ctx.canvas.width, ctx.canvas.height, gridSize)
    this.rawmaterialDemand = new RawmaterialDemand(ctx.canvas.width, ctx.canvas.height, gridSize)
    this.rawmaterialSupply = new RawMaterialSupply(ctx.canvas.width, ctx.canvas.height, gridSize)
    //log population to check the values
    // console.log(this.population)
    // console.log(this.travelPopulation)
    // console.log(this.rawmaterialDemand)
    this.rawmaterialDemand.displayStatistics()
  }
  
  getCashInHand() {
    return this.financials.cashInHand
  }
  getCoachCost() {
    return this.financials.coachCost
  }
  getEngineCost() {
    return this.financials.engineCost
  }
  getStationCost() {
    return this.financials.stationCost
  }
  getFlyoverCost() {
    return this.financials.FlyoverCost
  }
  getCollisionCost() {
    return this.financials.collisionCost
  }
  getTrackCostPerUnit() {
    return this.financials.trackCostPerUnit
  }
  getCoachCapacity() {
    return Train.coachPassengerCapacity 
  }
  getTotalTimeUnits() {
    return this.totalTimeUnits
  }
  getMaxNumCoaches() {
    return Train.maxNumCoaches
  }
  getMaxNumFreightWagons() {
    return Train.maxNumFreightWagons
  }
  getFreightWagonCost() {
    //for the time being same cost as passenger coach
    return this.financials.coachCost
  }
  getTrackCost(positions) {
    return Track.getTrackLength(positions)* this.getTrackCostPerUnit()
  }
  getCumProfit() {
    return this.financials.cumProfitByTrain.reduce((acc, profit) => acc + profit, 0)
  }
  getRank() {
    //change this after we start saving the games to the database
    
    return 1
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
      this.financials.buyCoach(this.getCurrentTimeIndex(), trainNumber, 1) 
    }
  }

  removeCoach(trainNumber) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      train.removeCoach()
      // we do not refund the cost of the coach when it is removed to keep it simple. 
      // This is a design choice and we can change it later if needed.
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

  addFlyover(row, col) {
    const flyover = new Flyover( row, col)
    this.Flyovers.addFlyover(flyover)
  }

  getNumberOfFlyovers(){
    return this.Flyovers.getAllFlyovers().length
  }

  validateUniqueStationDistances(stations, trainNumber) {
    const seenDistances = new Map()
    for (const station of stations) {
      const distance = station.distanceFromStart
      if (seenDistances.has(distance)) {
        const firstStationName = seenDistances.get(distance)
        console.warn(
          `[Station Guard] Duplicate distanceFromStart (${distance}) for train ${trainNumber}: ${firstStationName} and ${station.name}`
        )
      } else {
        seenDistances.set(distance, station.name)
      }
    }
  }

  addTrain( positions, engineSpeed,  numCoaches, delayBeforeStart, intersections, options = {}) {

    // Apply freight train defaults automatically when trainType is 'freight'
    if (options.trainType === 'freight') {
      options = {
        visualLengthScale: 0.35,
        maxVisualCoaches: 18,
        color: 'rgba(80,80,80,0.75)',
        ...options
      }
    }

    // if there is a train that is removed and has null value in the trains array, we can reuse that train slot for the new train. This way we can keep the train number consistent and avoid issues with train numbers changing after a train is removed.
    const nullIndex = this.trains.findIndex(train => train === null)
    let trainNumber;
    if (nullIndex !== -1) {
      trainNumber = nullIndex + 1
    } else {
      trainNumber = this.trains.length + 1
    }
    // const stations = new Stations()
    const stationType = numCoaches <= 5 ? 'small' : numCoaches <= 10 ? 'medium' : 'large'
    const firstPosition = positions[0]
    const lastPosition = positions[positions.length - 1]

    const track = new Track(this.ctxTracks, positions,'',this.gridSize)

    if(firstPosition.x == lastPosition.x && firstPosition.y == lastPosition.y){
      alert('The starting and ending positions are the same. Please choose different positions for the starting and ending points.')
      return
    } else{
      //we add small stations at both starting and ending points
      track.addStation(createStation(this.ctxTracks, firstPosition.x, firstPosition.y, this.gridSize, 0 , `S${trainNumber}${String((firstPosition.x / this.gridSize) + 1).padStart(2, '0')}${String((firstPosition.y / this.gridSize) + 1).padStart(2, '0')}`, 30, false, stationType))
      track.addStation(createStation(this.ctxTracks, lastPosition.x, lastPosition.y, this.gridSize, 0,  `S${trainNumber}${String((lastPosition.x / this.gridSize) + 1).padStart(2, '0')}${String((lastPosition.y / this.gridSize) + 1).padStart(2, '0')}`, 30, false, stationType))
      intersections.updateIntersectionsWithStationLocation(firstPosition.y/this.gridSize, firstPosition.x/this.gridSize, 'Station')
      intersections.updateIntersectionsWithStationLocation(lastPosition.y/this.gridSize, lastPosition.x/this.gridSize, 'Station')
      if(!options.partOfInitialSetup){
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber, stationType)
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber, stationType)
      }
    }
    // if (stations.length > 1) {
    //   stations[1].distanceFromStart = track.totalLength
    // }
    this.validateUniqueStationDistances(track.stations.getAllStations(), trainNumber)
    this.addTrack(track)
    const colorConfig = this.TRAINCONFIG[(trainNumber - 1) % this.TRAINCONFIG.length]
    const color = options.color ?? colorConfig.Color
    const trainName = options.trainName ?? colorConfig.defaultName
    const train = new Train({
      ctx: this.ctx,
      ctxTemp: this.ctxTemp,
      speed: engineSpeed,
      track,
      color,
      numCoaches,
      trainName,
      delayBeforeStart,
      trainNumber,
      intersections,
      financials: this.financials,
      travelPopulation: this.travelPopulation,
      rawMaterialDemand: this.rawmaterialDemand,
      rawMaterialSupply: this.rawmaterialSupply,
      getCurrentTimeIndex: () => this.getCurrentTimeIndex(),
      trainType: options.trainType,
      visualLengthScale: options.visualLengthScale,
      maxVisualCoaches: options.maxVisualCoaches
    })
    const length = track.getTotalLength()
    const currentTimeIndex = this.getCurrentTimeIndex()
    if(!options.partOfInitialSetup){
      this.financials.incrementTrackCost(currentTimeIndex, trainNumber, length)
      this.financials.buyEngine(currentTimeIndex, trainNumber)
      this.financials.buyCoach(currentTimeIndex, trainNumber, numCoaches)
    }
    this.trains[trainNumber - 1] = train
    const trainElement = document.querySelector(`#train${trainNumber}`)
    if (trainElement) {
      if(nullIndex !== -1){
        trainElement.style.filter = "none"
      } else{
      trainElement.style.display = 'grid'
      }
      trainElement.style.backgroundColor = color
      //if freight train them disable the speed control buttons for that train
      if(options.trainType === 'freight'){
        const speedUpButton = document.querySelector(`#speedUpTrain${trainNumber}`)
        const slowDownButton = document.querySelector(`#slowDownTrain${trainNumber}`)
        if (speedUpButton) {
          speedUpButton.disabled = true
          speedUpButton.style.cursor = 'not-allowed'
        }
        if (slowDownButton) {
          slowDownButton.disabled = true
          slowDownButton.style.cursor = 'not-allowed'
        }
      }
    }
    return trainNumber
  }

  addFreightTrain(positions, engineSpeed, numCoaches, delayBeforeStart, intersections, options = {}) {
    return this.addTrain(positions, engineSpeed, numCoaches, delayBeforeStart, intersections, {
      trainType: 'freight',
      visualLengthScale: 0.35,
      maxVisualCoaches: 18,
      color: 'rgba(80,80,80,0.75)',
      ...options
    })
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
            const stations = train.track.stations.getAllStations()
            stations.forEach(station => {
              station.draw()
            })
          }
      })
      const trainElement = document.querySelector(`#train${trainNumber}`)
      if (trainElement) {
        trainElement.style.filter = "blur(5px)"
      }
      this.Flyovers.draw()
    }
  }
  addStation(trainNumber, x, y, name, stopDuration, stationType, options = {}) {
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1]
      const station = createStation(this.ctxTracks, x, y, this.gridSize, 0, name, stopDuration, stationType)
      train.addStation(station)
      train.intersections.updateIntersectionsWithStationLocation(y / this.gridSize, x / this.gridSize, 'Station')
      if(!options.partOfInitialSetup){
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber, stationType)
      }
    }
  }
  getCumFinancialSummaryByTrain() {
    return this.financials.getCumFinancialSummaryByTrain()
  }

  incrementTimeUnit() {
    this.rawmaterialSupply.incrementTimeUnit()
    this.rawmaterialDemand.incrementTimeUnit()

    this.financials.incrementTimeUnit()
    // this.travelPopulation.incrementTimeUnit()
  }
}
export {
  Game
}