class TrainInfo {

  static MAX_ENTRIES_PER_PERIOD = 200

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
    const entries = this.trainInfo[trainNumber - 1][timeIndex]
    entries.push(info)
    if (entries.length > TrainInfo.MAX_ENTRIES_PER_PERIOD) {
      // Keep only the most recent events to avoid unbounded growth.
      entries.splice(0, entries.length - TrainInfo.MAX_ENTRIES_PER_PERIOD)
    }
  }

}
export {TrainInfo};