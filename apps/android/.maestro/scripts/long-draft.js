// 7100 latin letters. The composer cap is 7000.
// Maestro's inputText call is killed after 120 seconds, so the draft is typed
// as 500-character pieces (part0..part14) instead of one paste.
var chunk = 'aaaaaaaaaa';
var draft = '';
var i;
for (i = 0; i < 710; i++) {
  draft += chunk;
}
if (draft.length !== 7100) {
  throw new Error('expected 7100 characters, got ' + draft.length);
}
output.draft = draft;
var size = 500;
var index = 0;
var joined = '';
for (i = 0; i < draft.length; i += size) {
  var piece = draft.substring(i, i + size);
  output['part' + index] = piece;
  joined += piece;
  index += 1;
}
if (index !== 15 || joined !== draft) {
  throw new Error('expected 15 pieces covering 7100 characters, got ' + index);
}
