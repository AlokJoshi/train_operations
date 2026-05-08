class Stations {
  constructor() {
    this.stations = []
  }
  addStation(station) {
    this.stations.push(station)
    // after adding the station we need to update the station number and totalStations properties of all the stations 
    // based on the distance from start property of the station.
    const totalStations = this.stations.length
    this.stations.sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    this.stations.forEach((station, index) => {
      station.stationNumber = index + 1
      station.totalStations = totalStations
    })
  }
  getAllStations() {
    return this.stations
  }
}
export { Stations }