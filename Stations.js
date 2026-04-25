import { Station } from "./Station.js"
import { Intersections} from "./Intersections.js"
class Stations {
  constructor() {
    this.stations = []
  }
  addStation(name, row, col) {
    const station = new Station(name, row, col)
    this.stations.push(station)
    Intersections.updateIntersection(row, col, station)
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
    Intersections.updateIntersection(row, col, null)
  }
  draw() {
    this.stations.forEach(station => {
      station.draw()
    })
  }
}
export {
  Stations
}