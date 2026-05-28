class Rawmaterials {
  //How it works
  // uniform 0-1
  // const t = rawValue / upperBound

  // // apply power — exponent > 1 skews toward 0 (most areas sparse)
  // //               exponent < 1 skews toward upperBound (most areas dense)
  // const skewed = Math.pow(t, exponent)

  // return Math.round(skewed * upperBound)
  /*
  With exponent = 3, ~90% of grid points will have low rawmaterial and a few will be very high — realistic for a map with a couple of dense cities surrounded by countryside.
  
  The skew is now controlled by a skewExponent parameter (default 3). A few reference points:
  
  skewExponent	Effect
  1	Uniform — original behaviour
  2	Mildly skewed, most areas below 50%
  3	Strongly skewed, few high-rawmaterial hotspots (default)
  0.5	Inverse — most areas are dense, few are very sparse
  To change it at construction time:
  
  new Rawmaterial(CANVASWIDTH, CANVASHEIGHT, gridSize, 123456789, 3)
  //                                                              ^ change this
  */
  static UPPER_BOUND = 1000000
  static NE_ADJUST = 5.0  // increase raw material availablity in northeast quadrant.
  static VERYSMALL_ADJUST = 0.01  // reduce rawmaterial in very big cities to make them more distinct
  static PRUNE_BELOW = 20000 // prune raw material below this value to create more empty space on the map and make the hotspots more distinct
  
  constructor(canvasWidth, canvasHeight, gridSize, seed = 987654321, skewExponent = 5) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.seed = seed >>> 0
    this.values = new Map()
    this.upperBound = Rawmaterials.UPPER_BOUND
    this.skewExponent = skewExponent  // >1 skews toward 0 (sparse); <1 skews toward max (dense)
    this.generate()
    this.displayStatistics()
    // console.log(this.values)
  }

  displayStatistics() {
    const rawmaterials = Array.from(this.values.values())
    const totalRawmaterial = rawmaterials.reduce((a, b) => a + b, 0)
    // console.log(`Total Rawmaterial: ${totalRawmaterial}`)
    //north/south divide only
    let northRawmaterial = 0
    let southRawmaterial = 0
    let eastRawmaterial = 0
    let westRawmaterial = 0
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const pop = this.values.get(this.getKey(x, y)) ?? 0
        if (y < this.canvasHeight / 2) {
          northRawmaterial += pop
        } else if (y > this.canvasHeight / 2) {
          southRawmaterial += pop
        } else {
          northRawmaterial += pop / 2
          southRawmaterial += pop / 2
        }
        if (x < this.canvasWidth / 2) {
          westRawmaterial += pop
        } else if (x > this.canvasWidth / 2) {
          eastRawmaterial += pop
        } else {
          westRawmaterial += pop / 2
          eastRawmaterial += pop / 2
        }
      }
    }
    // console.log(`North Rawmaterial: ${northRawmaterial}`)
    // console.log(`South Rawmaterial: ${southRawmaterial}`)
    // console.log(`East Rawmaterial: ${eastRawmaterial}`)
    // console.log(`West Rawmaterial: ${westRawmaterial}`)
  }

  getKey(x, y) {
    return `${x},${y}`
  }

  // Coordinate-based hash gives deterministic pseudo-random values for each grid point.
  // do not use this directly. Use the getRawmaterialAt method which has modified vaues for certain grid points to create interesting hotspots.
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
          // apply northeast adjustment factor to create a lopsided availability of raw material so that most of it is in the northeast quadrant
          this.values.set(this.getKey(x, y), Math.round(this.valueFromCoordinate(x, y) * Rawmaterials.NE_ADJUST))
        } else {
          this.values.set(this.getKey(x, y), this.valueFromCoordinate(x, y))
        }
        if (this.values.get(this.getKey(x, y)) < Rawmaterials.PRUNE_BELOW) {
          this.values.set(this.getKey(x, y), 0)
        }
      }
    }
    this.values.set('1200,500',0) // prune raw material at this grid point since this is a very big city
  }

  getRawmaterialAt(x, y) {
    const snappedX = Math.round(x / this.gridSize) * this.gridSize
    const snappedY = Math.round(y / this.gridSize) * this.gridSize
    return this.values.get(this.getKey(snappedX, snappedY)) ?? 0
  }

  getAll() {
    const result = []
    this.values.forEach((rawmaterial, key) => {
      const [x, y] = key.split(',').map(Number)
      result.push({ x, y, rawmaterial })
    })
    return result
  }
}

export {
  Rawmaterials
}