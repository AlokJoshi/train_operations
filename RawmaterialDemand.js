class RawmaterialDemand {
  // The raw material demand map is generated using a Perlin noise function, which creates a smooth, natural-looking distribution of values.


  constructor(canvasWidth, canvasHeight, gridSize) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.values = new Map()
    this.generate()
    this.displayStatistics()
  }
  generate() {
    this.values.set('300,200', 50000)
    this.values.set('300,600', 500000)
    this.values.set('100,700', 100000)
    this.values.set('200,1400', 10000)
    this.values.set('1000,400', 700000)
    this.values.set('1900,1000', 300000)
    this.values.set('1600,1100', 100000)
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
    console.log(`Total Rawmaterial Demand: ${totalRawmaterialDemand}`)
  }
}
export { RawmaterialDemand }