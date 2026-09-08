class Stations {
  constructor() {
    this.stations = []
  }

  reindexByDistance() {
    const totalStations = this.stations.length
    this.stations.sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    this.stations.forEach((station, index) => {
      station.stationNumber = index + 1
      station.totalStations = totalStations
    })
  }

  addStation(station) {
    this.stations.push(station)
    // After adding a station, station order/numbering must be based on current track distance.
    this.reindexByDistance()
  }

  deleteStation(station) {
    const index = this.stations.findIndex(item => item === station)
    if (index !== -1) {
      this.stations.splice(index, 1)
      this.reindexByDistance()
    }
  }

  getAllStations() {
    return this.stations
  }

  getRemovableStations(){
    // first and last stations are not removable
    if (this.stations.length <= 2) {
      return []
    }
    return this.stations.slice(1, this.stations.length - 1) 
  } 
  getStationAt(x, y) {
    return this.stations.find(station => station.x === x && station.y === y)
  }

}
export { Stations }