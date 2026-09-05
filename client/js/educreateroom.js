"use scrict";
let rooms = JSON.parse(localStorage.getItem("escapeRooms")) || [];
let results = JSON.parse(localStorage.getItem("escapeResults")) || [];

//page nav
function showPage(page){
    document.getElementById("roomsPage").classList.add("hidden");
    document.getElementById("createPage").classList.add("hidden");
    document.getElementById("resultsPage").classList.add("hidden");

    if (page === "rooms"){
        document.getElementById("roomsPage").classList.remove("hidden");
        displayRooms();
    }
        if (page === "create"){
        document.getElementById("createPage").classList.remove("hidden");
    }
        if (page === "results"){
        document.getElementById("resultsPage").classList.remove("hidden");
        displayResults();
    }
}
// create room
document.getElementById("roomForm").addEventListener("submit", (event) => {event.preventDefault();
    const id= document.getElementById("roomId").value;
    const room = {
        id: id || Date.now(),
        name: document.getElementById("roomName").value,
        description: document.getElementById("roomDescription").value,
        time: Number(document.getElementById("roomTime").value)
    };
    if (id){
        const index = rooms.findIndex(r => r.id ==id);
        rooms[index] = room;
    } else {
        rooms.push(room);
    }
    saveRooms();
    document.getElementById("roomForm").reset();
    document.getElementById("roomId").value = "";
    document.getElementById("formTitle").textContent = "Create Room";

    showPage("rooms");
});
//edit
function editRoom(id) {
    const room = rooms.find(r => r.id == id);
    if (!room) return;
    document.getElementById("roomId").value = room.id;
    document.getElementById("roomName").value = room.name;
    document.getElementById("roomDescription").value = room.description;
    document.getElementById("roomTime").value = room.time;
    document.getElementById("formTitle").textContent = "Edit Escape Room";
    showPage("create");
}
//delete
function deleteRoom(id){
    const confirmed = 
        confirm("Are you sure?");
    if (!confirmed) return;
    rooms = rooms.filter(room => room.id != id);
    saveRooms();
    displayRooms();
}
//save
function saveRooms(){
    localStorage.setItem(
        "escapeRooms",
        JSON.stringify(rooms)
    );
}
//play room
function playRoom(id){
    const room = rooms.find(r => r.id == id);
    if(!room) return;
    const studentName = prompt("Student name:");
    if (!studentName) return;
    const startTime = Date.now();
    const answer = prompt(
      `${room.name}\n\n` + 
      `${room.description}\n\n` + 
      `Answer`  
    );
    const endTime = Date.now();
    const seconds = Math.round((endTime - startTime) / 1000);
    //test
    const correctAnswer = "escape";
    const success = answer && answer.toLowerCase() === correctAnswer;
    const result = {
        id: Date.now(),
        student: studentName,
        room: room.name,
        success: success,
        time: seconds,
        date: new Date().toLocaleString()
    };
    results.push(result);
    localStorage.setItem(
        "escapeResults",
        JSON.stringify(results)
    );
    if (success){
        alert ("You win");
    } else {
        alert("you lose");
    }
}
//display results
function displayResults(){
    const resultsList = document.getElementById("resultsList");
    resultsList.innerHTML = "";
    if(results.length ===0){
        resultsList.innerHTML = "no results yet";
        return;
    }
    results.forEach(result => {
        const div = document.createElement("div");
        div.className = "room";
        div.innerHTML = `
        <h3>${result.student}</h3>
        <p>${result.room}</p>
        <p>${result.time}</p>
        <p>Results: ${result.success}</p>
        `;
        resultsList.appendChild(div);
    });
}
function displayRooms() {
    const roomList = document.getElementById("roomList");
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const div = document.createElement("div");
        div.className = "room";
        div.innerHTML = `
            <h3>${room.name}</h3>
            <p>${room.description}</p>
            <p>${room.time} minutes</p>
            <button onclick="playRoom(${room.id})">Play</button>
            <button onclick="editRoom(${room.id})">Edit</button>
            <button onclick="deleteRoom(${room.id})">Delete</button>
        `;
        roomList.appendChild(div);
    });
}