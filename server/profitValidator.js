const DEFAULT_RULES = {
  initialCash: 20000000,
  coachCost: 100000,
  engineCost: 3000000,
  engineUpgradeCost: 2000000,
  stationCost: 1000000,
  trackCostPerUnit: 1000,
  collisionCost: 10000000,
  flyoverCost: 20000000,
  trackMaintenanceCostPerUnitPerTimePeriod: 2,
  stationMaintenanceCostPerStationPerTimePeriod: 50,
  depreciationOnEngineAndCoaches: 0.80
}

function createEmptySummary(maxTrains = 9, rules = DEFAULT_RULES) {
  return {
    cashInHand: rules.initialCash,
    totalRevenueByTrain: new Array(maxTrains).fill(0),
    totalExpensesByTrain: new Array(maxTrains).fill(0),
    profitByTrain: new Array(maxTrains).fill(0)
  }
}

function assertTrainNumber(trainNumber, maxTrains) {
  if (!Number.isInteger(trainNumber) || trainNumber < 1 || trainNumber > maxTrains) {
    throw new Error(`Invalid trainNumber: ${trainNumber}`)
  }
}

function assertNonNegativeNumber(value, field) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${field}: ${value}`)
  }
}

function addRevenue(summary, trainNumber, amount) {
  const idx = trainNumber - 1
  summary.totalRevenueByTrain[idx] += amount
  summary.profitByTrain[idx] += amount
  summary.cashInHand += amount
}

function addExpense(summary, trainNumber, amount) {
  const idx = trainNumber - 1
  summary.totalExpensesByTrain[idx] += amount
  summary.profitByTrain[idx] -= amount
  summary.cashInHand -= amount
}

function applyEvent(summary, event, rules = DEFAULT_RULES, maxTrains = 9) {
  if (!event || typeof event !== 'object') {
    throw new Error('Event must be an object')
  }

  const type = event.type
  if (typeof type !== 'string' || type.length === 0) {
    throw new Error('Event type is required')
  }

  switch (type) {
    case 'buyCoach': {
      assertTrainNumber(event.trainNumber, maxTrains)
      const count = Number(event.count)
      assertNonNegativeNumber(count, 'count')
      addExpense(summary, event.trainNumber, rules.coachCost * count)
      return
    }
    case 'buyEngine': {
      assertTrainNumber(event.trainNumber, maxTrains)
      addExpense(summary, event.trainNumber, rules.engineCost)
      return
    }
    case 'upgradeEngine': {
      assertTrainNumber(event.trainNumber, maxTrains)
      addExpense(summary, event.trainNumber, rules.engineUpgradeCost)
      return
    }
    case 'addStation': {
      assertTrainNumber(event.trainNumber, maxTrains)
      addExpense(summary, event.trainNumber, rules.stationCost)
      return
    }
    case 'trackCost': {
      assertTrainNumber(event.trainNumber, maxTrains)
      const distance = Number(event.distance)
      assertNonNegativeNumber(distance, 'distance')
      addExpense(summary, event.trainNumber, rules.trackCostPerUnit * distance)
      return
    }
    case 'collision': {
      assertTrainNumber(event.trainNumber1, maxTrains)
      assertTrainNumber(event.trainNumber2, maxTrains)
      const half = rules.collisionCost / 2
      addExpense(summary, event.trainNumber1, half)
      addExpense(summary, event.trainNumber2, half)
      return
    }
    case 'flyover': {
      assertTrainNumber(event.trainNumber1, maxTrains)
      assertTrainNumber(event.trainNumber2, maxTrains)
      const half = rules.flyoverCost / 2
      addExpense(summary, event.trainNumber1, half)
      addExpense(summary, event.trainNumber2, half)
      return
    }
    case 'periodMaintenance': {
      assertTrainNumber(event.trainNumber, maxTrains)
      const numStations = Number(event.numStations)
      const distanceTraveled = Number(event.distanceTraveled)
      const numCoaches = Number(event.numCoaches)
      assertNonNegativeNumber(numStations, 'numStations')
      assertNonNegativeNumber(distanceTraveled, 'distanceTraveled')
      assertNonNegativeNumber(numCoaches, 'numCoaches')

      const stationMaintenance = rules.stationMaintenanceCostPerStationPerTimePeriod * numStations
      const trackMaintenance = rules.trackMaintenanceCostPerUnitPerTimePeriod * distanceTraveled
      const depreciation = (rules.engineCost + rules.coachCost * numCoaches) * rules.depreciationOnEngineAndCoaches
      addExpense(summary, event.trainNumber, stationMaintenance + trackMaintenance + depreciation)
      return
    }
    case 'ticketRevenue':
    case 'freightRevenue': {
      assertTrainNumber(event.trainNumber, maxTrains)
      const amount = Number(event.amount)
      assertNonNegativeNumber(amount, 'amount')
      addRevenue(summary, event.trainNumber, amount)
      return
    }
    default:
      throw new Error(`Unsupported event type: ${type}`)
  }
}

function replayEvents(events, options = {}) {
  const rules = options.rules || DEFAULT_RULES
  const maxTrains = Number.isInteger(options.maxTrains) ? options.maxTrains : 9
  const summary = createEmptySummary(maxTrains, rules)

  for (const event of events) {
    applyEvent(summary, event, rules, maxTrains)
  }

  return summary
}

module.exports = {
  DEFAULT_RULES,
  replayEvents
}
