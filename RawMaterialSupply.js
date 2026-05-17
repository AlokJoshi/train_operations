import { Rawmaterials} from './Rawmaterials.js'

class RawMaterialSupply {
  // Raw material reserves are available in Rawmaterial object but only this amount becomes available each time unit.
  static PRODUCTION_PER_TIME_UNIT = 0.01 
  // percentage of raw material from adjacent grid points that becomes available at this grid point each time unit, adjust as needed
  static PERCENT_FROM_ADJACENT = 0.8 

  constructor(canvasWidth,canvasHeight, gridSize) {
    // key: x,y string; value: number of travelers if a station is built there
    // we include the population at the grid point as well as the population one gridSize to the north, south east and west, to account for travelers who would use a station at this grid point but live just outside the grid point
    this.rawmaterials = new Rawmaterials(canvasWidth, canvasHeight, gridSize)
    // this map will contain the raw material that becomes available at each grid point at each time unit
    // we will reduce the amount when it is moved to a demand center and increase it when it is produced at the elapse of each time unit
    this.rawmaterialAvailability = new Map() 

    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.generateRawmaterialAvailability()
    console.log(this.rawmaterialAvailability)
    
  }
  
  generateRawmaterialAvailability() {

    // we go through each grid point in rawmaterials and calculate the amount of raw maerial that can become available there
    // based on the availability at that grid point and a percentage of the availability at he adjacent grid points
      for (const [key, rawmaterial] of this.rawmaterials.values.entries()) {
      const [x, y] = key.split(',').map(Number)
      const adjacentKeys = [
        `${x},${y}`,
        `${x + this.gridSize},${y}`,
        `${x - this.gridSize},${y}`,
        `${x},${y + this.gridSize}`,  
        `${x},${y - this.gridSize}`
      ]
      let totalRawmaterial = 0
      for (const adjKey of adjacentKeys) {
        if (this.rawmaterials.values.has(adjKey)) {
          if (adjKey === key) {
            totalRawmaterial += this.rawmaterials.values.get(adjKey) 
          } else {  
            totalRawmaterial += this.rawmaterials.values.get(adjKey)* RawMaterialSupply.PERCENT_FROM_ADJACENT
          }
        }
      }
      const availableRawmaterial = Math.floor(totalRawmaterial * RawMaterialSupply.PRODUCTION_PER_TIME_UNIT)
      this.rawmaterialAvailability.set(key,  { available: availableRawmaterial, availableNextTimeUnit: availableRawmaterial })
    }

  }

  availableAt(x, y) {
    const key = this.getKey(x, y)
    const availabilityData = this.rawmaterialAvailability.get(key) ?? { available: 0, availableNextTimeUnit: 0 }
    return availabilityData.available
  }

  incrementTimeUnit() {
    // at the elapse of each time unit we update the raw material availability based on the production and the movement of raw material to demand centers
    for (const [key, availabilityData] of this.rawmaterialAvailability.entries()) {
      // we update the availability for the next time unit based on the production and the movement of raw material to demand centers
      const newAvailable = availabilityData.availableNextTimeUnit
      this.rawmaterialAvailability.set(key, { available: availabilityData.available + newAvailable, availableNextTimeUnit: newAvailable })
    }
  }

  decreaseRawMaterial(x, y, amount) {
    // when raw material is moved to a demand center we decrease the available raw material at the grid point and increase the available raw material for the next time unit to simulate the movement of raw material to demand centers.
    const key = this.getKey(x, y)
    const availabilityData = this.rawmaterialAvailability.get(key) ?? { available: 0, availableNextTimeUnit: 0 }
    const newAvailable = Math.max(availabilityData.available - amount, 0)
    this.rawmaterialAvailability.set(key, { available: newAvailable, availableNextTimeUnit: availabilityData.availableNextTimeUnit })
  }

  getKey(x, y) {
    return `${x},${y}`
  }
}
export {
  RawMaterialSupply
}