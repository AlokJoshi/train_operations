class TravelPopulation {
  static TRAVEL_PER_TIME_UNIT = 0.001 // 0.1% of the population travels each time unit, adjust as needed
  constructor(population,canvasWidth,canvasHeight, gridSize) {
    // key: x,y string; value: number of travelers if a station is built there
    // we include the population at the grid point as well as the population one gridSize to the north, south east and west, to account for travelers who would use a station at this grid point but live just outside the grid point
    this.travelPopulation = new Map() 
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.generateTravelPopulation(population)
    this.displayStatistics()
  }
  
  generateTravelPopulation(population) {
    let grandTotalPopulation = 0

    for (const [key, pop] of population.values.entries()) {
      const [x, y] = key.split(',').map(Number)
      const adjacentKeys = [
        `${x},${y}`,
        `${x + population.gridSize},${y}`,
        `${x - population.gridSize},${y}`,
        `${x},${y + population.gridSize}`,
        `${x},${y - population.gridSize}`
      ]
      let totalPop = 0
      for (const adjKey of adjacentKeys) {
        if (population.values.has(adjKey)) {
          totalPop += population.values.get(adjKey)
        }
      }

      const travelPop = Math.floor(totalPop * TravelPopulation.TRAVEL_PER_TIME_UNIT)
      grandTotalPopulation += travelPop
      this.travelPopulation.set(key, { population: travelPop, percent: 0 })
    }

    for (const [key, travelData] of this.travelPopulation.entries()) {
      const percent = grandTotalPopulation > 0 ? (travelData.population / grandTotalPopulation) * 100 : 0
      this.travelPopulation.set(key, { population: travelData.population, percent })
    }
  }

  displayStatistics() {

    const travelPops = Array.from(this.travelPopulation.values())
    const totalPopulation = travelPops.reduce((a, b) => a + b.population, 0)
    console.log(`Total Travel Population: ${totalPopulation}`)
    //north/south divide only
    let northPopulation = 0
    let southPopulation = 0
    let eastPopulation = 0
    let westPopulation = 0
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const travelData = this.travelPopulation.get(this.getKey(x, y)) ?? { population: 0, percent: 0 }
        const pop = travelData.population
        if (y < this.canvasHeight / 2) {
          northPopulation += pop
        } else if (y > this.canvasHeight / 2) {
          southPopulation += pop
        } else {
          northPopulation += pop / 2
          southPopulation += pop / 2
        }
        if (x < this.canvasWidth / 2) {
          westPopulation += pop
        } else if (x > this.canvasWidth / 2) {
          eastPopulation += pop
        } else {
          westPopulation += pop / 2
          eastPopulation += pop / 2
        }
      }
    }
    console.log(`North Travel Population: ${northPopulation}`)
    console.log(`South Travel Population: ${southPopulation}`)
    console.log(`East Travel Population: ${eastPopulation}`)
    console.log(`West Travel Population: ${westPopulation}`)
  }

  getKey(x, y) {
    return `${x},${y}`
  }
}
export {
  TravelPopulation
}