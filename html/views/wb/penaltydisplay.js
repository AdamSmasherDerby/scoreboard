$(initialize);

var penaltyEditor = null;
var period = null;
var jam = null;
var teamId = null;
var skaterId = null;
var penaltyId = null;
var fo_exp = null;
var nrows = 5;
var penalties = {1: {}, 2: {}};

function initialize() {
// Run when the screen is loaded
	
	// From /json/WS.js
	WS.Connect();
	WS.AutoRegister();

	// For each team register connections for the name, alternate name, and colors
	$.each([1, 2], function(idx, t) {
		WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ]); 
		WS.Register([ 'ScoreBoard.Team(' + t + ').AlternateName' ]);
		WS.Register([ 'ScoreBoard.Team(' + t + ').Color' ], function(k, v) { 
			$('.Team' + t + 'custColor').css('color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)']); 
			$('.Team' + t + 'custColor').css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
			$('#head' + t).css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
			});
	});
	
	// Register connections for the period and jam numbers
	WS.Register( [ 'ScoreBoard.Clock(Period).Number' ], function(k, v) { period = v; });
	WS.Register( [ 'ScoreBoard.Clock(Jam).Number' ], function(k, v) { jam = v; });

	// Register connections for the skaters
	// skaterUpdate arguments: team number, key, value
	WS.Register( [ 'ScoreBoard.Team(1).Skater' ], function(k, v) { skaterUpdate(1, k, v); } );
	WS.Register( [ 'ScoreBoard.Team(2).Skater' ], function(k, v) { skaterUpdate(2, k, v); } );
	
}

function adjust(which, inc) {
	var elem = $(".PenaltyEditor ." + which);
	console.log(elem, elem.val(), inc);
	elem.val(parseInt(elem.val()) + inc);
}

function clear() {
	console.log(penaltyId, skaterId);
	if (penaltyId == null || skaterId == null) {
		penaltyEditor.dialog("close");
	} else {
		WS.Command("Penalty", { teamId: teamId, skaterId: skaterId, penaltyId: penaltyId, fo_exp: fo_exp, jam: 0, period: 0 });
		penaltyEditor.dialog('close');
	}
}

var skaterIdRegex = /Skater\(([^\)]+)\)/;
var penaltyRegex = /Penalty\(([^\)]+)\).Code/;
function skaterUpdate(t, k, v) { 
	// Called when ScoreBoard.Team(t).Skater changes
	// Should recreate the table by adding the penalty 
	
	// Extract skater ID from k.  Quit if no match.
	match = k.match(skaterIdRegex); 
	if (match == null || match.length == 0)
		return;
	var id = match[1]; // id = skater id	
	
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ')';  
	//Example: prefix = ScoreBoard.Team(1).Skater(id)
	
	if (k == prefix + '.Number') {
		// This branch fires when the view is launched or when a new game is started.
		
		// If the value is null, return
		if (v == null) {
			return;
		}
		
		// Populate team name and colors
		setTeamName(t);
		
	} else {  
		// If the key indicates that this is NOT a skater number, we check to see if it's a 
		// new penalty code

		// Attempt to extract penalty from the key
		match = k.match(penaltyRegex);
		if (match == null || match.length == 0)
			return;
		var p = match[1];
		
		var name = WS.state[prefix + '.Name']
		var number = WS.state[prefix + '.Number']
		// Add penalty to display
		displayPenalty(t, id, p, name, number);

	}
}

function displayPenalty(t, s, p, name, number) { 
	// Given a team, a skater ID, penalty number, name, and number, update the table.
	
	var priorNumber = '';
	var priorName = '';
	var priorCode = '';
	var priorTotal = '';
	
	// Define elements to change
	var numberBox = $('.Team' + t + ' .Row[id=Row' + t + '0] .Number')
	var nameBox = $('.Team' + t + ' .Row[id=Row' + t + '0] .Name')
	var codeBox = $('.Team' + t + ' .Row[id=Row' + t + '0] .Code')

	// Repopulate penalty array for this skater
	penalties[t][s] = getPenalties(t,s);
	code = penalties[t][s][p].code;
	var total = Object.keys(penalties[t][s]).length;
	
	if (code != null) {
	// If the code exists, update the penalty box data and text
		
		for (var row = 4; row > 0 ; row--){
			priorName = $('.Team' + t + ' .Row[id=Row' + t + String(row-1) + '] .Name').text();
			$('.Team' + t + ' .Row[id=Row' + t + String(row) + '] .Name').text(priorName);
			priorCode = $('.Team' + t + ' .Row[id=Row' + t + String(row-1) + '] .Code').text();
			$('.Team' + t + ' .Row[id=Row' + t + String(row) + '] .Code').text(priorCode);	
			priorNumber = $('.Team' + t + ' .Row[id=Row' + t + String(row-1) + '] .Number').text();
			$('.Team' + t + ' .Row[id=Row' + t + String(row) + '] .Number').text(priorNumber);
		}
		// Store the period and the jam for the penalty as attributes of the row for sorting.
		$('.Team' + t + ' .Row[id=Row' + t + String(row) + ']').data('period',penalties[t][s][p].period);
		$('.Team' + t + ' .Row[id=Row' + t + String(row) + ']').data('jam',penalties[t][s][p].jam);
		nameBox.text(name)
		numberBox.text(number);
		codeBox.text(code + ' (' + total + ')');

		
	} else {
	// If the code is blank, (i.e., someone cleared a code) do nothing
	// TODO - figure out a way to remove the line from the display in this case.
		return;
	}

}

function setTeamName(t) {
	// Populate team name and colors
	
	var team = $('.Team' + t + ' tbody');
	var head = document.getElementById('head' + t);
	
	
	// Retrieve team name and colors from websocket
	var teamName = WS.state['ScoreBoard.Team(' + t + ').Name'];
	var teamFColor = WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)'];
	var teamBColor = WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)'];	
	if (WS.state['ScoreBoard.Team(' + t + ').AlternateName(whiteboard)'] != null) {
		teamName = WS.state['ScoreBoard.Team(' + t + ').AlternateName(whiteboard)']
	}

	// Redo the header line for the team name.
	head.innerHTML = '<span class="Team' + t + 'custColor"; style="font-size: 200%;">' + teamName + '</span>';
	$('.Team' + t + 'custColor').css('color', teamFColor);
	$('.Team' + t + 'custColor').css('background-color', teamBColor);	
}

function getPenalties(t, id) {
// Given a team and skater ID, add their penalties to the penalty array.
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ').Penalty(';
	var skaterPenalties = {};
	var code = '';
	
	for (var n=1; n < 10; n++){
		code = WS.state[prefix + n + ').Code']
		if (code == undefined){
			return skaterPenalties;
		}
		skaterPenalties[n] = {
				code: code,
				period: WS.state[prefix + n + ').Period'],
				jam: WS.state[prefix + n + ').Jam']
		}
	}
	return skaterPenalties;
}

