class RawmaterialDemand {
  // this is the demand for raw materials per time period at each grid point. This is where the factories are located. 
  // The demand will be fulfilled by the raw material supply and the transportation network. 
  // The demand will be reduced when raw material is moved to the demand center and increased 
  // automatically at the elapse of each time unit to simulate the ongoing demand for raw materials.
  constructor(canvasWidth, canvasHeight, gridSize) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.singlePeriodDemand = [
      { x: 300, y: 200, demand: 50000 },
      { x: 300, y: 600, demand: 500000 },
      { x: 100, y: 700, demand: 100000 }, 
      { x: 200, y: 1400, demand: 10000 },
      { x: 1000, y: 400, demand: 700000 },
      { x: 1900, y: 1000, demand: 300000 },
      { x: 1600, y: 1100, demand: 100000 }
    ]
    this.values = new Map()
    this.generate()
    this.displayStatistics()
  }
  generate() {
    for (const { x, y, demand } of this.singlePeriodDemand) {
      this.values.set(this.getKey(x, y), demand)
    }
  }
  incrementTimeUnit() {
    // at the elapse of each time unit we increment the demand 
    // based on the remaining unfulfilled demand and a percentage increase in the single period demand to simulate the ongoing demand for raw materials.
    for (const [key, demand] of this.values.entries()) {
      const unfulfilledDemand = Number.isFinite(demand) ? demand : 0
      const baseDemand = this.singlePeriodDemand.find(d => this.getKey(d.x, d.y) === key)?.demand ?? 0
      const newDemand = baseDemand * 1.01 // increase demand by 1% each time unit, adjust as needed
      this.values.set(key, unfulfilledDemand + newDemand)
    }
  }
  getKey(x, y) {
    return `${x},${y}`
  }
  getAll() {
    const result = []
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const rawmaterial = this.values.get(this.getKey(x, y)) ?? 0
        result.push({ x, y, rawmaterial })
      }
    }
    return result
  }

  displayStatistics() {
    const rawmaterialDemand = Array.from(this.values.values())
    const totalRawmaterialDemand = rawmaterialDemand.reduce((a, b) => a + b, 0)
    // console.log(`Total Rawmaterial Demand: ${totalRawmaterialDemand}`)
  }

  demandAt(x, y) {
    // when we calculate the demand at a grid point we include the demand at the grid point
    // but we add a percentage of the demand at all the adjacent grid points. Here we consider
    // all 24 adjacent grid points to account for demand that is just outside the grid point but would still be served by a station at this grid point.
    let totalDemand = 0
    for (let dy = -2*this.gridSize; dy <= 2*this.gridSize; dy += this.gridSize) {
      for (let dx = -2*this.gridSize; dx <= 2*this.gridSize; dx += this.gridSize) {
        const currentDemand = this.values.get(this.getKey(x + dx, y + dy))
        const demand = Number.isFinite(currentDemand) ? currentDemand : 0
        // console.log(`Demand at ${x + dx}, ${y + dy} = ${demand}`)
        if (dx === 0 && dy === 0) {
          // demand at the grid point itself counts fully
          totalDemand += demand
        } else if (Math.abs(dx) == 2*this.gridSize || Math.abs(dy) === 2*this.gridSize) {
          // demand at adjacent grid points counts as a percentage of the demand at those points, adjust the percentage as needed
          totalDemand += demand * 0.1
        } else {
          totalDemand += demand * 0.5
        }
      }
    } 

    return totalDemand
  }
  decreaseDemand(x, y, amount) {
    const key = this.getKey(x, y)
    const currentDemand = this.values.get(key) ?? 0
    const newDemand = Math.max(currentDemand - amount, 0)
    this.values.set(key, newDemand)
  } 
}
export { RawmaterialDemand }