class Financials {
  // track maintenance cost is calculated based on the distance traveled by the train on the track. 
  // We can have a fixed cost per unit distance traveled on the track. This way, the user will have 
  // to invest in maintaining the track if they want their trains to run smoothly and avoid breakdowns. 
  // This will add an additional layer of strategy for the user when they are building their tracks and stations.
  constructor(totalTimeUnits = 100) {
    this.totalRevenue = Array.from({ length: totalTimeUnits }, () => new Array(9).fill(0))
    this.totalExpenses = Array.from({ length: totalTimeUnits }, () => new Array(9).fill(0))
    this.numStations = Array.from({ length: totalTimeUnits }, () => new Array(9).fill(0)) // to keep track of the number of stations for each train at each time unit for calculating station maintenance/operating cost.
    this.profit = Array.from({ length: totalTimeUnits }, () => new Array(9).fill(0))
    this.stationCost = 1000000
    this.FlyoverCost = 20000000
    this.engineCost = 3000000
    this.coachCost = 100000
    this.collisionCost = 10000000
    this.trackCostPerUnit = 1000
    this.depreciationOnEngineAndCoaches = 0.80
    this.cumRevenueByTrain = new Array(9).fill(0)
    this.cumCostByTrain = new Array(9).fill(0)
    this.cumProfitByTrain = new Array(9).fill(0)
    this.trackMaintenanceCostPerUnitPerTimePeriod = 10
    this.stationMaintenanceCostPerStationPerTimePeriod = 200
    this.cashInHand = 5000000
  }
  incrementExpensesOfStationMaintenance(timeIndex,train, numStations) {
    const trainIndex = train.trainNumber - 1
    const cost = this.stationMaintenanceCostPerStationPerTimePeriod * numStations
    this.incrementExpenses(timeIndex, trainIndex, cost, 'Station Maintenance')
  } 
  incrementExpensesOfTrackMaintenance(timeIndex,train, distanceTraveled) {
    const trainIndex = train.trainNumber - 1
    const cost = this.trackMaintenanceCostPerUnitPerTimePeriod * distanceTraveled
    this.incrementExpenses(timeIndex, trainIndex, cost, 'Track Maintenance')
  }
  incrementExpensesOfEngineAndCoachesDepreciation(timeIndex, trainNumber, numCoaches) {
    const trainIndex = trainNumber - 1
    const engineDepreciation = this.engineCost * this.depreciationOnEngineAndCoaches
    const coachesDepreciation = this.coachCost * numCoaches * this.depreciationOnEngineAndCoaches
    const totalDepreciation = engineDepreciation + coachesDepreciation
    this.incrementExpenses(timeIndex, trainIndex, totalDepreciation, 'Engine and Coaches Depreciation')
  } 
  incrementNumStations(timeIndex, trainIndex) {
    this.numStations[timeIndex][trainIndex] ++
  }
  incrementRevenue(timeIndex, trainIndex, amount, reason='') {
    this.totalRevenue[timeIndex][trainIndex] += amount
    this.cumRevenueByTrain[trainIndex] += amount
    this.cumProfitByTrain[trainIndex] += amount
    // this.updateProfit(timeIndex, trainIndex)
    this.profit[timeIndex][trainIndex] += amount
    this.cashInHand += amount
    // console.log(`Revenue incremented by $${amount.toLocaleString('en-US')} Train ${trainIndex + 1} Reason: ${reason} | Cash in Hand: $${this.cashInHand.toLocaleString('en-US')}`)
  }
  incrementExpenses(timeIndex, trainIndex, amount, reason='') {
    this.totalExpenses[timeIndex][trainIndex] += amount
    this.cumCostByTrain[trainIndex] += amount
    this.cumProfitByTrain[trainIndex] -= amount
    // this.updateProfit(timeIndex, trainIndex)
    this.profit[timeIndex][trainIndex] -= amount
    this.cashInHand -= amount
    if(trainIndex === 1){
      console.log(`Expenses incremented by $${amount.toLocaleString('en-US')} Train ${trainIndex + 1} Reason: ${reason} | Cash in Hand: $${this.cashInHand.toLocaleString('en-US')}`)
    }
  }
  updateProfit(timeIndex, trainIndex) {
    // this.profit[timeIndex][trainIndex] = this.totalRevenue[timeIndex][trainIndex] - this.totalExpenses[timeIndex][trainIndex]
  }

  incrementTimeUnit() {
    // const lastTimeIndex = this.totalRevenue.length - 1
    // const newRevenue = new Array(9).fill(0)
    // const newExpenses = new Array(9).fill(0)
    // const newProfit = new Array(9).fill(0)
    // this.totalRevenue.push(newRevenue)
    // this.totalExpenses.push(newExpenses)
    // this.profit.push(newProfit)
  }

  getCumFinancialSummaryByTrain() {
    return {
      totalRevenue:this.cumRevenueByTrain,
      totalExpenses:this.cumCostByTrain,
      profit:this.cumProfitByTrain
    }
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
    this.incrementExpenses(timeIndex, trainIndex, cost, 'Buying Coaches')
    return cost
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  buyEngine(timeIndex, trainNumber) {
    const trainIndex = trainNumber - 1
    this.incrementExpenses(timeIndex, trainIndex, this.engineCost, 'Buying Engine')
    return this.engineCost
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  incrementTrackCost(timeIndex, trainNumber, distance) {
    const trainIndex = trainNumber - 1
    const cost = this.trackCostPerUnit * distance
    this.incrementExpenses(timeIndex, trainIndex, cost, 'Track Cost')
    return cost
  }

  //this is called externally and hence we use ticks, trainNumber to call it
  incrementCollisionCost(timeIndex, trainNumber1, trainNumber2) {
    const trainIndex1 = trainNumber1 - 1
    const trainIndex2 = trainNumber2 - 1
    this.incrementExpenses(timeIndex, trainIndex1, this.collisionCost / 2, 'Collision Cost')
    this.incrementExpenses(timeIndex, trainIndex2, this.collisionCost / 2, 'Collision Cost')
    return this.collisionCost
  }

  //increment the cost of flyover which is shared by two trains that are involved
  incrementFlyoverCost(timeIndex, trainNumber1, trainNumber2) {
    const trainIndex1 = trainNumber1 - 1
    const trainIndex2 = trainNumber2 - 1
    this.incrementExpenses(timeIndex, trainIndex1, this.FlyoverCost / 2, 'Flyover Cost')
    this.incrementExpenses(timeIndex, trainIndex2, this.FlyoverCost / 2, 'Flyover Cost')
    return this.FlyoverCost
  }

  getStationCost(){
    return this.stationCost
  }

  addStation(timeIndex, trainNumber, type) {
    const cost = this.getStationCost(type)
    const trainIndex = trainNumber - 1
    this.incrementExpenses(timeIndex, trainIndex, cost, 'Adding Station')
    this.incrementNumStations(timeIndex, trainIndex)
  }

  incrementRevenueFromTickets(timeIndex, trainNumber, amount) {
    const trainIndex = trainNumber - 1
    this.incrementRevenue(timeIndex, trainIndex, amount, 'Ticket Revenue')
    return amount
  }

  incrementRevenueFromRawMaterial(timeIndex, trainNumber, amount) {
    const trainIndex = trainNumber - 1
    this.incrementRevenue(timeIndex, trainIndex, amount, 'Freight Revenue')
    return amount
  }
  cumProfit() {
    return this.cumProfitByTrain.reduce((a, b) => a + b, 0)
  } 
}
export { Financials }