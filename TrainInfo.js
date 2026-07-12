class TrainInfo {

  constructor(numTrains,numPeriods) {
    this.numTrains = numTrains;
    this.numPeriods = numPeriods;
    this.trainInfo = Array.from({ length: numTrains }, () => new Array(numPeriods).fill(null))
  }
  getTrainInfoForTrainAndTimeIndex(trainNumber, timeIndex) {
    return this.getTrainInfo(trainNumber, timeIndex)
  }
  getTrainInfoAllPeriods(trainNumber) {
    if (trainNumber < 1 || trainNumber > this.numTrains) {
      throw new Error(`Invalid train number: ${trainNumber}`)
    }
    return this.trainInfo[trainNumber - 1]
  }
  getTrainInfo(trainNumber, timeIndex) {
    if (trainNumber < 1 || trainNumber > this.numTrains) {
      throw new Error(`Invalid train number: ${trainNumber}`)
    }
    if (timeIndex < 0 || timeIndex >= this.numPeriods) {
      throw new Error(`Invalid time index: ${timeIndex}`)
    }
    return this.trainInfo[trainNumber - 1][timeIndex]
  }

  setTrainInfo(trainNumber, timeIndex, info) {
    if (trainNumber < 1 || trainNumber > this.numTrains) {
      throw new Error(`Invalid train number: ${trainNumber}`)
    }
    if (timeIndex < 0 || timeIndex >= this.numPeriods) {
      throw new Error(`Invalid time index: ${timeIndex}`)
    }
    if(this.trainInfo[trainNumber - 1][timeIndex] == null) {
      this.trainInfo[trainNumber - 1][timeIndex] = []
    }
    this.trainInfo[trainNumber - 1][timeIndex].push(info)
  }

}
export {TrainInfo};