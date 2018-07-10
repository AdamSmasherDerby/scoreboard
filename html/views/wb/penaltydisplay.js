$(initialize);

var period = null;
var jam = null;
var nrows = 5;
var totalPenalties = {1: 0, 2: 0}

function initialize() {
// Run when the screen is loaded
	
	totalPenalties = {1: 0, 2: 0}
	
	WS.Connect();
	WS.AutoRegister();

	// For each team register connections for the name, alternate name, and colors
	$.each([1, 2], function(idx, t) {
		WS.Register( [ 'ScoreBoard.Team(' + t + ').Name' ], function(k, v) { setTeamName(t); }); 
		WS.Register([ 'ScoreBoard.Team(' + t + ').AlternateName' ], function(k,v) { setTeamName(t) });
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

var skaterIdRegex = /Skater\(([^\)]+)\)/;
var penaltyRegex = /Penalty\(([^\)]+)\).Code/;
function skaterUpdate(t, k, v) { 
// Called when ScoreBoard.Team(t).Skater changes
// Checks to see if the change is to skater's information or to a penalty
// If a penalty, call displayPenalty to add it to the board
	
	// Extract skater ID from k.  Quit if no match.
	match = k.match(skaterIdRegex); 
	if (match == null || match.length == 0)
		return;
	var id = match[1]; // id = skater id	
	
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ')';  
	//Example: prefix = ScoreBoard.Team(1).Skater(id)
	
	if (k == prefix + '.Number') {
		// This branch only fires when the view is launched or when a new game is started.
		
		// If the value is null, return
		if (v == null) {
			return;
		}
		
	} else {  
		// If the key indicates that this is NOT a skater number, we check to see if it's a 
		// new penalty code

		// Attempt to extract penalty from the key
		match = k.match(penaltyRegex);
		if (match == null || match.length == 0)
			return;
		var p = match[1];
		
		// Add penalty to display
		displayPenalty(t, id, p);

	}
}

function displayPenalty(t, s, p) { 
	// Given a team, a skater ID, penalty number, name, and number, update the table.
	
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + s + ').Penalty(' + p + ')';
	var period = WS.state[prefix + '.Period'];
	var jam = WS.state[prefix + '.Jam'];
	var code = WS.state[prefix + '.Code'];
	var name = WS.state['ScoreBoard.Team(' + t + ').Skater(' + s + ').Name']
	var number = WS.state['ScoreBoard.Team(' + t + ').Skater(' + s + ').Number']
	var teamTable = $('.Team' + t + ' tbody');
	var rowPeriod;
	var rowJam;
	var row;
	var newRow
	
	//TODO - Make foul outs and expulsions pretty.
	
	if (code == null){
	// If a penalty is cleared, remove it from the table and append a blank line at the end.
	// Regenerating the entire table might be an option, but this is probably preferable,
	// given that there's no way to enforce same jam penalties going back up in the right order.
		var clearMatch = teamTable.find('tr')
			.filter(function() {return $(this).data("id") == s && $(this).data("penalty") == p})
		if (clearMatch.size() > 0) {
			clearMatch.remove();
			teamTable.append($("<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>"));
			totalPenalties[t] -= 1;
			setTeamName(t);
		}
		return
	}
	
	for (var n = 1; n <= nrows; n++){
	// If this penalty is more recent than any of the penalties in the list, insert it
	// in the list at that point. (starting from the top)
		row = teamTable.find('tr:eq(' + n + ')')
		rowPeriod = row.data().period
		rowJam = row.data().jam
		if (rowPeriod == undefined
			|| period > rowPeriod 
			|| (period == rowPeriod && jam >= rowJam)){
				newRow = $('<tr>').addClass('Penalty').data({
					"period": period, 
					"jam": jam,
					"id": s,
					"penalty": p
			});
			newRow.append($('<td>').addClass('Number').text(number));
			newRow.append($('<td>').addClass('Name').text(name));
			newRow.append($('<td>').addClass('Code').text(code + ' (' + p + ')'));
			row.before(newRow);
			teamTable.find('tr:last').remove();
			totalPenalties[t] += 1;
			setTeamName(t);
			return;
		}
	}
	
	
	return;

}

function setTeamName(t) {
	// Populate team name
	
	var team = $('.Team' + t + ' tbody');
	var head = document.getElementById('head' + t);
	
	// Retrieve team name from websocket
	var teamName = WS.state['ScoreBoard.Team(' + t + ').Name'];
	if (WS.state['ScoreBoard.Team(' + t + ').AlternateName(whiteboard)'] != null) {
		teamName = WS.state['ScoreBoard.Team(' + t + ').AlternateName(whiteboard)']
	}

	// Redo the header line for the team name.
	head.innerHTML = '<span class="Team' + t + 'custColor"; style="font-size: 200%;">' + teamName + ' - ' + totalPenalties[t] +  '</span>';
}




