class Population {
  //How it works
  // uniform 0-1
  // const t = rawValue / upperBound

  // // apply power — exponent > 1 skews toward 0 (most areas sparse)
  // //               exponent < 1 skews toward upperBound (most areas dense)
  // const skewed = Math.pow(t, exponent)

  // return Math.round(skewed * upperBound)
  /*
  With exponent = 3, ~90% of grid points will have low population and a few will be very high — realistic for a map with a couple of dense cities surrounded by countryside.
  
  The skew is now controlled by a skewExponent parameter (default 3). A few reference points:
  
  skewExponent	Effect
  1	Uniform — original behaviour
  2	Mildly skewed, most areas below 50%
  3	Strongly skewed, few high-population hotspots (default)
  0.5	Inverse — most areas are dense, few are very sparse
  To change it at construction time:
  
  new Population(CANVASWIDTH, CANVASHEIGHT, gridSize, 123456789, 3)
  //                                                              ^ change this
  */
  static UPPER_BOUND = 1000000
  static NE_ADJUST = 0.5  // reduce population in northeast quadrant to create a more interesting map with one dense city and one sparse city
  static VERYBIG_ADJUST = 5  // increase population in very big cities to make them more distinct
  constructor(canvasWidth, canvasHeight, gridSize, seed = 123456789, skewExponent = 4) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.seed = seed >>> 0
    this.values = new Map()
    this.upperBound = Population.UPPER_BOUND
    this.skewExponent = skewExponent  // >1 skews toward 0 (sparse); <1 skews toward max (dense)
    this.generate()
    this.displayStatistics()
  }

  displayStatistics() {
    const populations = Array.from(this.values.values())
    const totalPopulation = populations.reduce((a, b) => a + b, 0)
    console.log(`Total Population: ${totalPopulation}`)
    //north/south divide only
    let northPopulation = 0
    let southPopulation = 0
    let eastPopulation = 0
    let westPopulation = 0
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const pop = this.values.get(this.getKey(x, y)) ?? 0
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
    console.log(`North Population: ${northPopulation}`)
    console.log(`South Population: ${southPopulation}`)
    console.log(`East Population: ${eastPopulation}`)
    console.log(`West Population: ${westPopulation}`)
  }

  getKey(x, y) {
    return `${x},${y}`
  }

  // Coordinate-based hash gives deterministic pseudo-random values for each grid point.
  valueFromCoordinate(x, y) {
    let h = this.seed
    h ^= (x + 0x9e3779b9 + (h << 6) + (h >> 2)) >>> 0
    h ^= (y + 0x85ebca6b + (h << 6) + (h >> 2)) >>> 0
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
    h = (h ^ (h >>> 16)) >>> 0
    const uniform = (h % (this.upperBound + 1)) / this.upperBound  // normalise to 0-1
    const skewed = Math.pow(uniform, this.skewExponent)             // apply power curve
    return Math.round(skewed * this.upperBound)  // scale back to 0-upperBound
  }

  generate() {
    this.values.clear()
    for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
      for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
        if (x > this.canvasWidth / 2 && y < this.canvasHeight / 2) {
          // apply northeast adjustment factor to create a more interesting map with one dense city and one sparse city
          this.values.set(this.getKey(x, y), Math.round(this.valueFromCoordinate(x, y) * Population.NE_ADJUST))
        } else {
          this.values.set(this.getKey(x, y), this.valueFromCoordinate(x, y))
        }
      }
    }
    this.values.set('1200,500',this.valueFromCoordinate(1200,500) * Population.VERYBIG_ADJUST) // make this city very big to create a distinct high-population hotspot
  }

  getPopulationAt(x, y) {
    const snappedX = Math.round(x / this.gridSize) * this.gridSize
    const snappedY = Math.round(y / this.gridSize) * this.gridSize
    return this.values.get(this.getKey(snappedX, snappedY)) ?? 0
  }

  getAll() {
    const result = []
    this.values.forEach((population, key) => {
      const [x, y] = key.split(',').map(Number)
      result.push({ x, y, population })
    })
    return result
  }
}

export {
  Population
}