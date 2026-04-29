import { Flyover } from "./Flyover.js"
import { Intersections} from "./Intersections.js"
class Flyovers {
  constructor(ctx,gridSize, offsetX=0, offsetY=0) {
    this.ctx = ctx
    this.gridSize = gridSize
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.stations = []
    this.possibleStationLocations = []
  }
  setPossibleStationLocations(locations) {
    this.possibleStationLocations = locations
  }
  addStation(station) {
    this.stations.push(station)
    station.draw(this.ctx, this.gridSize, this.offsetX, this.offsetY)
    return station
  }
  getStationAtPosition(row, col) {
    return this.stations.find(station => station.row === row && station.col === col)
  }
  isStationAtPosition(row, col) {
    return this.stations.some(station => station.row === row && station.col === col)
  }
  getAllStations() {
    return this.stations
  }
  deleteStation(row, col) {
    this.stations = this.stations.filter(station => !(station.row === row && station.col === col))
    // Intersections.updateIntersection(row, col, null)
  }
  draw() {
    this.stations.forEach(station => {
      station.draw(this.ctx, this.gridSize, this.offsetX, this.offsetY)
    })
  }
}
export {
  Flyovers
}