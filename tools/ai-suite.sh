#!/bin/bash
# Серия испытаний Combat AI v1: 9 сценариев × 2 режима (текущий / без ролей и докладов) × N seed. Итог — tools/ai-suite-sum.cjs
cd "$(dirname "$0")/.."; export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}
O=${1:-/tmp/suite}; N=${2:-3}; T=${3:-1500}; mkdir -p $O
M8="BB,BB,LR,PD,PD,IC,IC,MS"; M12="BB,BB,BB,LR,LR,PD,PD,PD,IC,IC,IC,MS"
declare -A S=( [1_8v8]="$M8;$M8" [2_12v12]="$M12;$M12" [3_superior]="$M8;BB,LR,PD,IC" [4_range]="LR,LR,LR,LR,PD,PD;BB,BB,FR,FR,PD,PD"
 [5_icVSheavy]="IC,IC,IC,IC,IC,IC,PD;BB,BB,BB" [6_damaged]="BB*,BB*,LR*,PD,IC*,IC,MS;BB,BB,LR,PD,IC,IC,MS" [7_flagloss]="$M8;$M8" [8_retreat]="BB*,LR*,PD,IC*;$M8" [9_homog]="FR,FR,FR,FR,FR,FR;FR,FR,FR,FR,FR,FR" )
declare -A P=( [new]='{}' [base]='{"planner":{"wrole":0},"fleetcmd":{"fb":0}}' )
j=0; for k in "${!S[@]}"; do for m in new base; do KF=0; [ "$k" = 7_flagloss ] && KF=300
  COMP="${S[$k]}" KILLF=$KF node tools/duel-test.cjs $N "${P[$m]}" $T comp > $O/$k.$m.txt 2>&1 &
  j=$((j+1)); if [ $((j%6)) = 0 ]; then wait; fi; done; done; wait
