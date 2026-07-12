function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  // You can use the whole div or a specific handle to drag
  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    const interactiveSelector = 'input, textarea, select, button, label, i, a'
    if (e.target.closest(interactiveSelector)) {
      return
    }
    e.preventDefault();
    // Get cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    // Calculate new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }

}

function ck(value) {
  return Math.round(value / 1000)
}

function rowAndColumnName(x, y, gridSize) {
  const n = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const col = Math.floor(x / gridSize)
  const row = Math.floor(y / gridSize)
  const colName = alpha(col)
  const rowName = alpha(row)
  return [rowName, colName]
}

function alpha(index) {
  const n = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return (index > n.length ? n[Math.floor((index / n.length)-1)] : '') + n[index % n.length]
}

function getDetailedSegmentsMap(positions, turningCircle=100, gridSize=50) {
    if (!Array.isArray(positions) || positions.length < 2) {
      return new Map()
    }
    const segmentsMap = new Map()
    const modifiedPositions = []
    let firstx = positions[0].x
    let firsty = positions[0].y
    let secondx, secondy, thirdx, thirdy
    modifiedPositions.push({x: firstx, y: firsty})
    for (let i = 1; i < positions.length; i++) {
      secondx = positions[i].x
      secondy = positions[i].y
      thirdx = positions[i + 1]?.x
      thirdy = positions[i + 1]?.y
      if(firstx === secondx && secondx === thirdx) {
        // vertical segment will collapse into a single vertical position in the modifiedPositions array
        if(i==positions.length-1) {
          modifiedPositions.push({x: secondx, y: secondy})
        }
      } else if(firsty === secondy && secondy === thirdy) {
        // horizontal segment will collapse into a single horizontal position in the modifiedPositions array
        if(i==positions.length-1) {
          modifiedPositions.push({x: secondx, y: secondy})
        }
        
      } else {
        // neither vertical nor horizontal segment, keep the position as is
        modifiedPositions.push({x: secondx, y: secondy})
        firstx = secondx
        firsty = secondy
      }
    }
    // console.log(modifiedPositions)
    //now use the modifiedPositions to create the segments map
    //note that our map is for segment betwee each grid position
    let startx,starty, endx, endy
    let newModifiedPositions = []
    let n=0
    for (let i = 1; i < modifiedPositions.length; i++) {
      startx = modifiedPositions[i-1].x
      starty = modifiedPositions[i-1].y
      newModifiedPositions.push({x: startx, y: starty}) 
      endx = modifiedPositions[i].x
      endy = modifiedPositions[i].y
      n = i==modifiedPositions.length-1 ? 1:0
      if (endx === startx) {
        //in this case the segment is vertical but because the next segment is going to be horizontal
        //we take off the turning radius  from the end point
        const dir = endy > starty ? 1 : -1
        for(let j=1; j<Math.abs(starty-endy)/gridSize + n; j++)     {
          newModifiedPositions.push({x: startx, y: starty + j * gridSize * dir,direction:'vertical'})
        }
      }
      if (endy === starty) {
        //in this case the segment is horizontal but because the next segment is going to be vertical
        //we take off the turning radius  from the end point
        const dir = endx > startx ? 1 : -1
        for(let j=1; j<Math.abs(startx-endx)/gridSize + n; j++)     {
          newModifiedPositions.push({x: startx + j * gridSize * dir, y: starty,direction:'horizontal'})
        }
      }
      startx = endx
      starty = endy
    }
    // console.log(newModifiedPositions)
    for(let j = 1; j<newModifiedPositions.length;j++){
      const prev = newModifiedPositions[j-1]
      const curr = newModifiedPositions[j]
      if(j>1 && (prev.direction=='vertical' || prev.direction=='horizontal') && curr.direction==null) {
        // mark the previous point as skip
        prev.skip = true
        // mark the current point as skip
        curr.skip = true
        if(j+2 < newModifiedPositions.length) {
          const next = newModifiedPositions[j+1]
          next.skip = true
        }
      }
    }

    for(let j = 0; j<newModifiedPositions.length-1;j++){
      const start = newModifiedPositions[j]
      const end = newModifiedPositions[j+1]
      if(start.skip || end.skip) {
        continue
      }
      segmentsMap.set(`${start.x},${start.y}-${end.x},${end.y}`, {startx: start.x, starty: start.y, endx: end.x, endy: end.y})
    }
    return segmentsMap
  }

  function getCommonSegmentsMap(positions1, positions2, turningCircle=100, gridSize=50) {
    const segmentsMap1 = getDetailedSegmentsMap(positions1, turningCircle, gridSize)
    const segmentsMap2 = getDetailedSegmentsMap(positions2, turningCircle, gridSize)
    // console.log(segmentsMap1)
    // console.log(segmentsMap2)
    const commonSegmentsMap = new Map()
    for (const key of segmentsMap1.keys()) {
      const keyAlternative = key.split('-').reverse().join('-')
      if (segmentsMap2.has(key) || segmentsMap2.has(keyAlternative)) {
        commonSegmentsMap.set(key, segmentsMap1.get(key))
      }
    }
    // console.log(commonSegmentsMap)
    return commonSegmentsMap
  }
  
export {
  makeDraggable,
  ck,
  rowAndColumnName,
  alpha,
  getDetailedSegmentsMap,
  getCommonSegmentsMap
}