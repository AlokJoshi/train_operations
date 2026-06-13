class Popups {
  // popups map will store an array of popup info for each station and train. 
  // The key will be the station or train coordinates in the format "x,y" and the value will be an array of popup info objects. 
  // Each popup info object will have a type (station or train) and the relevant information to display in the popup.
  constructor() {
    this.popupMap = new Map()
  }
  addStation(x, y, stationName) {
    const key = this.getKey(x, y)
    const popupInfo = this.popupMap.get(key) || {Stations:[], Trains:[]}
    if (!popupInfo.Stations.find(name => name === stationName)) {
      popupInfo.Stations.push(stationName)
    }
    this.popupMap.set(key, popupInfo)
  }
  addTrain({ x, y, stationName, trainNumber, trainInfo1, trainInfo2 }) {
    const key = this.getKey(x, y)
    const popupInfo = this.popupMap.get(key) || {Stations:[], Trains:[]}
    if (!popupInfo.Stations.find(station => station === stationName)) {
      popupInfo.Stations.push(stationName)
    }
    if (!popupInfo.Trains.find(train => train.Trainnumber === trainNumber)) {
      popupInfo.Trains.push({'Trainnumber': trainNumber, 'TrainInfo1': trainInfo1, 'TrainInfo2': trainInfo2})
    }else {
      // If the train already exists, update its information
      const existingTrain = popupInfo.Trains.find(train => train.Trainnumber === trainNumber)
      existingTrain.TrainInfo1 = trainInfo1
      existingTrain.TrainInfo2 = trainInfo2
    }
    this.popupMap.set(key, popupInfo)
  }
  getPopupInfo(x, y) {
    const key = this.getKey(x, y)
    return this.popupMap.get(key) || {Stations:[], Trains:[]}
  }
  getKey(x, y) {
    return `${x},${y}`
  }
}
export { 
  Popups
}