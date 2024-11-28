// Function to toggle dropdown visibility
  function toggleDropdown(id) {
    var element = document.getElementById(id);
    element.classList.toggle('open');
    if (element.style.display === "block") {
      element.style.display = "none";
    } else {
      element.style.display = "block";
    }
  }