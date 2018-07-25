$(initialize);

var period = null;
var jam = null;

function initialize() {
	WS.Connect();
	WS.AutoRegister();

	$.each([1, 2], function(idx, t) {
		WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ]); 
		WS.Register([ 'ScoreBoard.Team(' + t + ').AlternateName' ]);
		WS.Register([ 'ScoreBoard.Team(' + t + ').Color' ], function(k, v) { 
			$('.Team' + t + 'custColor').css('color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)']); 
			$('.Team' + t + 'custColor').css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
			$('#head' + t).css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); } );
	});
	WS.Register( [ 'ScoreBoard.Clock(Period).Number' ], function(k, v) { period = v; });
	WS.Register( [ 'ScoreBoard.Clock(Jam).Number' ], function(k, v) { jam = v; });

	WS.Register( [ 'ScoreBoard.Team(1).Skater' ], function(k, v) { skaterUpdate(1, k, v); } ); 
	WS.Register( [ 'ScoreBoard.Team(2).Skater' ], function(k, v) { skaterUpdate(2, k, v); } ); 

}