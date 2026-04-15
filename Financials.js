class Financials {
  constructor() {

    this.totalRevenue = 0
    this.totalExpenses = 0
    this.profit = 0

    this.engineCost = 1000000
    this.coachCost = 500000
    this.collisionCost = 20000000 
    this.trackCostPerUnit = 1000

    this.revenuePerUnitDistancePerCoach = 5
  }
  incrementRevenue(amount) {
    this.totalRevenue += amount
    this.updateProfit()
  }
  incrementExpenses(amount) {
    this.totalExpenses += amount
    this.updateProfit()
  }
  updateProfit() {
    this.profit = this.totalRevenue - this.totalExpenses
  }
  getFinancialSummary() {
    return {
      totalRevenue: this.totalRevenue,
      totalExpenses: this.totalExpenses,
      profit: this.profit
    }
  }
  buyCoach(numCoaches) {
    const cost = this.coachCost * numCoaches
    this.incrementExpenses(cost)
    return cost
  }
  buyEngine() {
    this.incrementExpenses(this.engineCost)
    return this.engineCost
  }
  incrementTrackCost(distance) {
    const cost = this.trackCostPerUnit * distance
    this.incrementExpenses(cost)
    return cost
  }
  incrementRevenueFromOperations(distance, numCoaches) {
    const revenue = this.revenuePerUnitDistancePerCoach * distance * numCoaches
    this.incrementRevenue(revenue)
    return revenue
  }
  incrementCollisionCost() {
    this.incrementExpenses(this.collisionCost)
    return this.collisionCost
  }
}
export const financials = new Financials()