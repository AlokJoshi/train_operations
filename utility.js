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

export { 
  makeDraggable,
  ck
}