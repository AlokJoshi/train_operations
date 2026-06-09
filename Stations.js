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
  getAllStations() {
    return this.stations
  }
}
export { Stations }