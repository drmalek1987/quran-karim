# Sprint 5b D: harmain 5:92 page turn (hifz test, p/l)

Root cause: not an app bug. 5:92 prints only 2 words on page 102 (lastOnShown=1), so hifzPageEnd fires when word 2 is heard.
hifzPageGo turns the page 150 ms later (setTimeout in hifzPageGo, app.js ~2512). split_turn.js waited only 60 ms per word for the
first 30% of the words (13 words -> c<=3), so the turn was seen one or two steps late (word 3/4 instead of 2). Reading mode (rdSplitTurn) has no delay, so it was "ok".
Precedent: the test's own 350 ms wait used for c > 30% of the words; extended to c <= 4.
Fix: tools/qa/sprint5/split_turn.js wait line: `(c > all.length*0.3) || c <= 4 || fin ? 350 : 60`. No change to web/.
Results: split_turn.js ED=harmain,shamarly 48/48 ok (before: harmain 5:92 hz p/l late/early). recite_sim.js: errs [], all pass.
ED=harmain ui.js: TOTAL 384 FAIL 0 (app untouched, so same as before).
