$(initialize);

var period = null;
var jam = null;
var nrows = 8;
var totalPenalties = {1: 0, 2: 0}
var skaterList = {1: {}, 2: {}}

function initialize() {
// Run when the screen is loaded
	
	totalPenalties = {1: 0, 2: 0}
	
	WS.Connect();
	WS.AutoRegister();

	// For each team register connections for the name, alternate name, and colors
	$.each([1, 2], function(idx, t) {
		initializeTeam(t);
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

function displayPenalty(t, id, p) { 
	// Given a team, a skater ID, penalty number, name, and number, update the table.
	
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ').Penalty(' + p + ')';
	var period = WS.state[prefix + '.Period'];
	var jam = WS.state[prefix + '.Jam'];
	var code = WS.state[prefix + '.Code'];
	var name = WS.state['ScoreBoard.Team(' + t + ').Skater(' + id + ').Name']
	var number = WS.state['ScoreBoard.Team(' + t + ').Skater(' + id + ').Number']
	var teamTable = $('.Team' + t + ' tbody');
	var updateMatch;
	var priorPenalty;
	var laterPenalties;
	var troubleBox = $('.Team' + t + ' .Trouble')
	
	if (p == 'FO_EXP'){ p = 10 } // Use p = 10 to ensure FO/EXPs always get sorted first.
	
	// Handle cleared and updated penalties.
	updateMatch = teamTable.find('tr')
		.filter(function() {return $(this).data("id") == id && $(this).data("penalty") == p})
		
	if (updateMatch.size() > 0){
		if (code == null){
		// If a penalty is cleared, remove it from the table and append a blank line at the end.
		// Regenerating the entire table might be an option, but this is probably preferable,
		// given that there's no way to enforce same jam penalties going back up in the right order.
			updateMatch.remove();
			teamTable.append($('<tr><td class="Number">&nbsp;</td>'
					+ '<td class="Name">&nbsp;</td><td class="Code">&nbsp;</td></tr>'));
			if (p == 10) { 
				delete skaterList[t][id].fo 
			} else {
				delete skaterList[t][id][p]
			};
			totalPenalties[t] = getTotalPenalties(t);
			setTeamName(t);
			troubleBox.html(troubleString(t)) 
			
		// Update the row attributes for later penalties.
			laterPenalties = teamTable.find('tr')
				.filter(function() {return $(this).data('id') == id	&& $(this).data('penalty') > p})
			laterPenalties.each(function(){
				$(this).data('penalty') - 1;
			})
				
		} else {
		// If a penalty is updated, update the code and the text, but don't change the total.
			skaterList[t][id][p] = code;
			updateMatch.data("code") == code;
			updateMatch.find('td.Code').text(code + ' (' + p +')');
		}
		return;
	}
	
	if (code == null){
	// Null codes can arrive in any order when board is reloaded.
		return;
	}
	
	// Update skater list.
	if (!skaterList[t].hasOwnProperty(id)) { skaterList[t][id] = {number: number} }
	if (!skaterList[t][id].hasOwnProperty(p) && p != 10) {skaterList[t][id][p] = code}
	if (p == 10) {skaterList[t][id].fo = true}
	
	// Update Totals
	totalPenalties[t] = getTotalPenalties(t);
	setTeamName(t);
	troubleBox.html(troubleString(t));
	
	if (code == 'FO') {
	// Do not add a line to the table for foulouts
		return;
	}
	
	// Create row to insert
	var nr = newRow(period, jam, id, p, name, number, code);
	setRowColor(nr); 
	var topRow = teamTable.find('tr:eq(1)');
	var sameJamSameSkater = teamTable.find('tr').filter(function() {
		return $(this).data("id") == id && $(this).data("jam") == jam && $(this).data("period") == period 
	})
	var sameJamDifferentSkater = teamTable.find('tr').filter(function() {
		return $(this).data('id') != id && $(this).data('jam') == jam && $(this).data('period') == period 
	})
	var previousJamSamePeriod = teamTable.find('tr').filter(function() {
		return ($(this).data('period') == period && $(this).data('jam') < jam)
			|| ($(this).data('period') < period);
	})
	
	// When a new penalty arrives:
	if (topRow == undefined
			|| topRow.data().period == undefined
			|| period > topRow.data().period
			|| (period == topRow.data().period && jam > topRow.data().jam)){
	// 0. Is the top row blank?  Insert this penalty at the top.
	// 1. Is this penalty a later period than the top row?  Insert it at the top.
	// 2. Is this penalty a later jam than the top row? Insert it at the top.
		
		$(nr).insertBefore(topRow);
		teamTable.find('tr:last').remove();
		
	} else if (sameJamDifferentSkater.size() > 0 && sameJamSameSkater.size() == 0) {
	// 3. Is this penalty a penalty for a currently visible jam, but for a skater 
	// who is not currently on the board for that jam? Insert it before the first 
	// penalty for that jam. (Potentially wrong, but not soluble.)
		
		$(nr).insertBefore(sameJamDifferentSkater[0]);
		teamTable.find('tr:last').remove();
		
	} else if (sameJamSameSkater.size() > 0){
	// 4. Is this penalty a penalty for a visible jam, but for a skater who IS 
	// currently on the list for that jam?
		
		priorPenalties = sameJamSameSkater.filter(function() {
			return( $(this).data('penalty') < p );
		})
		if (priorPenalties.size() == 0 ){
		// If this penalty is earlier than every penalty on the board for the current jam for the 
		// current skater, insert it after the last one. (Potentially out of order with other skaters, 
		// but insoluble.)
			
			$(nr).insertAfter(sameJamSameSkater.last());
			teamTable.find('tr:last').remove();
			
		} else if (topRow.data().jam == jam && nPenalties(t,id) <= p){
		// If this is the most recent penalty for this skater, and it is for the current jam,
		// insert it at the top of the list.
			
			$(nr).insertBefore(topRow);
			teamTable.find('tr:last').remove();
			
	    } else {
		// Otherwise, insert it above the latest prior penalty
			
			if (priorPenalties.size() > 1) {
				priorPenalties.sort(function(a,b) {
					return $(b).data('penalty') - $(a).data('penalty');})
			}
			$(nr).insertBefore(priorPenalties.first());
			teamTable.find('tr:last').remove();
	    }
		
	} else if (sameJamDifferentSkater.size() == 0 && sameJamSameSkater.size() == 0 && previousJamSamePeriod.size() > 0 ) {
			// 5. If there are earlier jams visible, but no penalties from this jam, insert it above the latest
			// previous penalty.	

				$(nr).insertBefore(previousJamSamePeriod.first());
				teamTable.find('tr:last').remove();
	}
	
	return;

}

function newRow(period, jam, id, p, name, number, code){
// Given a period, jam, skater id, and penalty, create a row for the table.
	
	var newRow = $('<tr>').addClass('Penalty').data({
		"period": period, 
		"jam": jam,
		"id": id,
		"penalty": p
	});
	newRow.append($('<td>').addClass('Number').text(number));
	newRow.append($('<td>').addClass('Name').text(name));
	if (p < 7) {
		newRow.append($('<td>').addClass('Code').text(code + ' (' + p + ')'));
	} else if ( p >= 7 && p <=9) {
		newRow.append($('<td>').addClass('Code').text(code + ' (' + p + ') FO'))
	} else {
		newRow.append($('<td>').addClass('Code').text(expText(code)));
	}
	return newRow;
}

function setRowColor(row){
// Given a row, set the color based on the number of penalties.
	
	row.toggleClass("Warn1", row.data('penalty') == 5 );
	row.toggleClass("Warn2", row.data('penalty') == 6 );
	row.toggleClass("Warn3", row.data('penalty') >= 7 );
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
	$('.Team' + t + 'custColor').css('color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)']); 
	$('.Team' + t + 'custColor').css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
}

function nPenalties(t, id) {
// Given a team and skater ID, get the number of penalties presently in the state.
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ').Penalty(';
	var nPenalties = 0;
	var code = '';
	
	for (var n=1; n < 10; n++){
		code = WS.state[prefix + n + ').Code']
		if (code == undefined){
			return nPenalties;
		} else if (code != 'FO_EXP'){
			nPenalties += 1
		}
	}
	
	return nPenalties;
}

function getTotalPenalties(t) {
// Get the total number of penalties in skaterList for a team.
	var total = 0;
	
	var skaterNumbers = Array.from(Object.keys(skaterList[t]));
	for (var idx in skaterNumbers) {
		var id = skaterNumbers[idx];
		total += Object.keys(skaterList[t][id]).length;
	}
	
	return total;
}

function initializeTeam(t) {
// Add the table body for each team.
	var teamTable = $('.Team' + t + ' tbody');
	
	for (var row = 1; row <= nrows; row ++){
		var newRow = $('<tr>').addClass('Penalty');
		newRow.append($('<td>').addClass('Number').html('&nbsp;'));
		newRow.append($('<td>').addClass('Name').html('&nbsp;'));
		newRow.append($('<td>').addClass('Code').html('&nbsp;'));
		teamTable.append(newRow)
	}
}

function troubleString(t) {
// Given a team id, return a string consisting of the skaters with 5 and 6 penalties
		
	var troubleList = {5: [], 6:[]};
	var troubleString = ''

	for (var key in skaterList[t]){
		if (skaterList[t][key].hasOwnProperty('7') || skaterList[t][key].hasOwnProperty('fo')){
			continue;
		} else if (skaterList[t][key].hasOwnProperty('6')){
			troubleList[6].push(skaterList[t][key].number);
		} else if (skaterList[t][key].hasOwnProperty('5')) {
			troubleList[5].push(skaterList[t][key].number);
		}
	}
	
	if (troubleList[5].length > 0) {
		troubleString += '<span class="left">(5) ' + troubleList[5].join(', ') + '</span>';
	} 
	if (troubleList[6].length > 0) {
		troubleString += '<span class="right">(6) ' + troubleList[6].join(', ') + '</span>';
	}
	
	return troubleString;
		
	}


function expText(txt) {
// Given a string of the form 'EXP-x', return 'x (EXP)'
// Return 'FO' unchanged
	
	if (txt == 'FO') { return txt; }
	var expRegex = /EXP-(\w)/;
	var match = txt.match(expRegex);
	return match[1] + ' (EXP)';
	
}