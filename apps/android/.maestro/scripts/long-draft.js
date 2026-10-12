// 7100 latin letters. The composer cap is 7000.
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
