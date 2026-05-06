class Financials {
  constructor(totalTimeUnits = 100) {
    this.totalRevenue = Array.from({ length: totalTimeUnits }, () => new Array(9).fill(0))
    this.totalExpenses = Array.from({ length: totalTimeUnits }, () => new Array(9).fill(0))
    this.profit = Array.from({ length: totalTimeUnits }, () => new Array(9).fill(0))
    this.STATION_COST_SMALL = 100000
    this.STATION_COST_MEDIUM = 400000
    this.STATION_COST_LARGE = 1000000
    this.FlyoverCost = 20000000
    this.engineCost = 3000000
    this.coachCost = 500000
    this.collisionCost = 20000000
    this.trackCostPerUnit = 1000
    this.depreciationOnEngineAndCoaches = 0.80
    this.revenuePerUnitDistancePerCoach = 5
  }
  incrementRevenue(timeIndex, trainIndex, amount) {
    this.totalRevenue[timeIndex][trainIndex] += amount
    this.updateProfit(timeIndex, trainIndex)
  }
  incrementExpenses(timeIndex, trainIndex, amount) {
    this.totalExpenses[timeIndex][trainIndex] += amount
    this.updateProfit(timeIndex, trainIndex)
  }
  updateProfit(timeIndex, trainIndex) {
    this.profit[timeIndex][trainIndex] = this.totalRevenue[timeIndex][trainIndex] - this.totalExpenses[timeIndex][trainIndex]
  }

  //this is called externally and hence we use ticks to call it
  getFinancialSummary(timeIndex) {
    const totalRevenue = this.totalRevenue[timeIndex].reduce((a, b) => a + b, 0)
    const totalExpenses = this.totalExpenses[timeIndex].reduce((a, b) => a + b, 0)
    const profit = this.profit[timeIndex].reduce((a, b) => a + b, 0)

    return {
      totalRevenue,
      totalExpenses,
      profit
    }
  }

  getFinancialSummaryByTrain(timeIndex) {
    const totalRevenue = this.totalRevenue[timeIndex]
    const totalExpenses = this.totalExpenses[timeIndex]
    const profit = this.profit[timeIndex]
    return {
      totalRevenue,
      totalExpenses,
      profit
    }
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  buyCoach(timeIndex, trainNumber, numCoaches) {
    const trainIndex = trainNumber - 1
    const cost = this.coachCost * numCoaches
    this.incrementExpenses(timeIndex, trainIndex, cost)
    return cost
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  buyEngine(timeIndex, trainNumber) {
    const trainIndex = trainNumber - 1
    this.incrementExpenses(timeIndex, trainIndex, this.engineCost)
    return this.engineCost
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  incrementTrackCost(timeIndex, trainNumber, distance) {
    const trainIndex = trainNumber - 1
    const cost = this.trackCostPerUnit * distance
    this.incrementExpenses(timeIndex, trainIndex, cost)
    return cost
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  incrementRevenueFromOperations(timeIndex, trainNumber, distance, numCoaches) {
    const trainIndex = trainNumber - 1
    const revenue = this.revenuePerUnitDistancePerCoach * distance * numCoaches
    this.incrementRevenue(timeIndex, trainIndex, revenue)
    return revenue
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  incrementCollisionCost(timeIndex, trainNumber1, trainNumber2) {
    const trainIndex1 = trainNumber1 - 1
    const trainIndex2 = trainNumber2 - 1
    this.incrementExpenses(timeIndex, trainIndex1, this.collisionCost / 2)
    this.incrementExpenses(timeIndex, trainIndex2, this.collisionCost / 2)
    return this.collisionCost
  }

  //increment the cost of flyover which is shared by two trains that are involved
  incrementFlyoverCost(timeIndex, trainNumber1, trainNumber2) {
    const trainIndex1 = trainNumber1 - 1
    const trainIndex2 = trainNumber2 - 1
    this.incrementExpenses(timeIndex, trainIndex1, this.FlyoverCost / 2)
    this.incrementExpenses(timeIndex, trainIndex2, this.FlyoverCost / 2)
    return this.FlyoverCost
  }

  getStationCost(type){
    return type === 'small' ? this.STATION_COST_SMALL : type === 'medium' ? this.STATION_COST_MEDIUM : this.STATION_COST_LARGE
  }
  
  addStation(timeIndex, trainNumber, type) {
    const cost = this.getStationCost(type)
    const trainIndex = trainNumber - 1
    this.incrementExpenses(timeIndex, trainIndex, cost)
  }
}
export { Financials }