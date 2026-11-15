#!/bin/bash
# A/B в одном бою: роли и доклады только у одной стороны (battle.ab.side), другая — без них; каждая пара — и со сменой сторон (снимает перекос стартовых позиций).
# Режимы: full — все роли; noЛиния/noПВО/noПерехват/noПоддержка — у ИИ-стороны выключена одна роль. Сводка: node tools/ab-sum.cjs <каталог>
cd "$(dirname "$0")/.."; export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}; O=${1:-/tmp/ab}; N=${2:-6}; T=${3:-1500}; mkdir -p $O
M8="BB,BB,LR,PD,PD,IC,IC,MS"; M12="BB,BB,BB,LR,LR,PD,PD,PD,IC,IC,IC,MS"; C=${COMP:-"$M8;$M8"}; TAG=${TAG:-8v8}
declare -A R=( [full]='' [noLine]=',"roff":["линия"]' [noPVO]=',"roff":["ПВО"]' [noIC]=',"roff":["перехват"]' [noSup]=',"roff":["поддержка"]' )
for m in ${MODES:-full noLine noPVO noIC noSup}; do for sd in 0 1; do
  COMP="$C" node tools/duel-test.cjs $N "{\"ab\":{\"side\":$sd},\"planner\":{\"wrole\":3${R[$m]}}}" $T comp > $O/$TAG.$m.s$sd.txt 2>&1 & done; done; wait
