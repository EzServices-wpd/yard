# F17 doors-over-drawers + hollow drawers: before / after per class member

Before = base 3ad1126 (release 10-21 + #92 63c7e25), after = this branch. I31/I32 are this branch's invariants run on both builds. Engine only, no xAI.

| # | Prompt | Before (parts, $, doors, drawer fronts, solid drawers) | Before I31/I32 | After (parts, $, doors, drawer fronts, hollow drawers) | After I31/I32 |
|---|---|---|---|---|---|
| 1 | filing cabinet 2 drawers | 19, $258.60, 2, 2, 2 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; names drawers and no doors, the model has 2 doors; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 15, $182.21, 0, 2, 2 hollow | pass |
| 2 | filing cabinet 4 drawers 18 wide 52 tall 24 deep | 28, $369.95, 1, 4, 4 solid | FAIL: Door lies over Drawer front 1; Shelf 1 runs through Drawer 2; names drawers and no doors, the model has 1 door; 18" slides on a 23 3/4" deep drawer box (it takes 22"); Drawer 1 is a solid drawer block | 25, $250.15, 0, 4, 4 hollow | pass |
| 3 | tool cabinet 24 wide 36 tall 12 deep with 2 doors and 3 drawers | 24, $297.55, 2, 3, 3 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; 16" slides on a 11 3/4" deep drawer box (it takes 10"); Drawer 1 is a solid drawer block | 25, $259.12, 2, 3, 3 hollow | pass |
| 4 | craft cabinet 30 wide 60 tall 16 deep with 2 doors and 2 drawers | 19, $306.02, 2, 2, 2 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 20, $267.59, 2, 2, 2 hollow | pass |
| 5 | hall cabinet 36 wide 34 tall 14 deep with 2 doors and 2 drawers | 19, $258.60, 2, 2, 2 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; 16" slides on a 13 3/4" deep drawer box (it takes 12"); Drawer 1 is a solid drawer block | 20, $258.60, 2, 2, 2 hollow | pass |
| 6 | file cabinet 20 wide 30 tall 24 deep with 1 door and 1 drawer | 13, $199.68, 1, 1, 1 solid | FAIL: Door lies over Drawer front; Shelf 1 runs through Drawer 1; 18" slides on a 23 3/4" deep drawer box (it takes 22"); Drawer 1 is a solid drawer block | 14, $201.68, 1, 1, 1 hollow | pass |
| 7 | walnut dresser 6 drawers 60 wide | 35, $1643.19, 0, 6, 6 solid | FAIL: Drawer 1 is 57 1/2" wide, more than one 36" drawer column; step 2 glues the drawer bottoms from boards, the cut list cuts them from 1/4" plywood 4x8 (backer); Drawer 1 is a solid drawer block | 36, $1783.23, 0, 6, 6 hollow | pass |
| 8 | dresser 36 wide 34 tall 18 deep with 4 drawers | 25, $259.13, 0, 4, 4 solid | FAIL: Drawer 1 is a solid drawer block | 25, $234.15, 0, 4, 4 hollow | pass |
| 9 | dresser 48 wide 40 tall 20 deep with 3 drawers and 2 doors | 22, $354.47, 2, 3, 3 solid | FAIL: Left door lies over Drawer front 1; Drawer 1 is 45 1/2" wide, more than one 36" drawer column; 16" slides on a 19 3/4" deep drawer box (it takes 18"); Drawer 1 is a solid drawer block | 24, $305.53, 2, 3, 3 hollow | pass |
| 10 | nightstand 18 wide 24 tall 16 deep with 2 drawers | 16, $143.78, 0, 2, 2 solid | FAIL: Shelf runs through Drawer 1; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 15, $143.78, 0, 2, 2 hollow | pass |
| 11 | nightstand with a drawer and a door | 11, $117.81, 0, 1, 1 solid | FAIL: 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer is a solid drawer block | 12, $152.76, 1, 1, 1 hollow | pass |
| 12 | kitchen island | 8, $90.31, 0, 0, 0 solid | pass | 17, $221.63, 2, 1, 1 hollow | pass |
| 13 | kitchen island 60x36x36 | 8, $175.64, 0, 0, 0 solid | pass | 23, $392.34, 2, 2, 2 hollow | pass |
| 14 | kitchen island 48 wide 36 tall 24 deep with 2 drawers and 2 doors | 8, $90.31, 0, 0, 0 solid | FAIL: asks for 2 drawers, the model has 0 | 23, $307.01, 2, 2, 2 hollow | pass |
| 15 | jewelry box with drawers | 8, $63.39, 0, 0, 0 solid | FAIL: asks for some drawers, the model has 0 | 22, $104.33, 0, 2, 2 hollow | pass |
| 16 | jewelry box 12 wide 8 tall 8 deep with 3 drawers | 12, $87.39, 0, 0, 0 solid | FAIL: asks for 3 drawers, the model has 0 | 34, $194.17, 0, 3, 3 hollow | pass |
| 17 | sideboard 60 wide 34 tall 18 deep with 2 doors and 3 drawers | 28, $362.94, 2, 3, 3 solid | FAIL: Left door lies over Drawer front 1; Bay 2 shelf 1 runs through Drawer 2; Drawer 1 is 57 1/2" wide, more than one 36" drawer column; Drawer 1 is a solid drawer block | 30, $346.43, 2, 3, 3 hollow | pass |
| 18 | utility cabinet 30 wide 72 tall 16 deep with 2 drawers 2 doors and 3 shelves | 20, $353.44, 2, 2, 2 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 21, $267.59, 2, 2, 2 hollow | pass |
| 19 | bathroom cabinet 24 wide 32 tall 18 deep with 1 drawer and 2 doors | 14, $219.65, 2, 1, 1 solid | FAIL: Left door lies over Drawer front; Shelf 1 runs through Drawer 1; Drawer 1 is a solid drawer block | 15, $219.65, 2, 1, 1 hollow | pass |
| 20 | chest of drawers 30 wide 44 tall 18 deep with 5 drawers | 30, $285.10, 0, 5, 5 solid | FAIL: Drawer 1 is a solid drawer block | 30, $260.12, 0, 5, 5 hollow | pass |
| 21 (extra) | hall cabinet 30x36x12 | 9, $165.72, 2, 0, 0 solid | pass | 9, $165.72, 2, 0, 0 hollow | pass |
| 22 (extra) | file cabinet | 24, $297.55, 2, 3, 3 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 25, $297.55, 2, 3, 3 hollow | pass |
| 23 (extra) | filing cabinet | 24, $297.55, 2, 3, 3 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 25, $297.55, 2, 3, 3 hollow | pass |
| 24 (extra) | walnut dresser | 20, $1034.34, 0, 3, 3 solid | FAIL: step 2 glues the drawer bottoms from boards, the cut list cuts them from 1/4" plywood 4x8 (backer); Drawer 1 is a solid drawer block | 20, $1034.34, 0, 3, 3 hollow | pass |
| 25 (extra) | dresser | 20, $208.18, 0, 3, 3 solid | FAIL: Drawer 1 is a solid drawer block | 20, $208.18, 0, 3, 3 hollow | pass |
| 26 (extra) | pocket vanity | 50, $636.23, 2, 6, 6 solid | FAIL: Left drawer 1 is a solid drawer block | 50, $636.23, 2, 6, 6 hollow | pass |
| 27 (extra) | 60" desk | 41, $344.99, 0, 6, 6 solid | FAIL: 18" slides on a 23 3/4" deep drawer box (it takes 22"); Left drawer 1 is a solid drawer block | 41, $356.99, 0, 6, 6 hollow | pass |
| 28 (extra) | wardrobe with drawers | 27, $486.77, 2, 3, 3 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 3; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 24, $402.90, 2, 3, 3 hollow | pass |
| 29 (extra) | closet with drawers | 26, $464.79, 2, 3, 3 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; names drawers and no doors, the model has 2 doors; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 25, $278.08, 0, 3, 3 hollow | pass |
| 30 (extra) | bookcase with drawers | 25, $291.53, 0, 3, 3 solid | FAIL: Shelf 1 runs through Drawer 1; 16" slides on a 11 3/4" deep drawer box (it takes 10"); Drawer 1 is a solid drawer block | 26, $214.67, 0, 3, 3 hollow | pass |
| 31 (extra) | linen closet with 2 drawers | 21, $416.85, 2, 2, 2 solid | FAIL: Left door lies over Drawer front 1; Shelf 1 runs through Drawer 1; names drawers and no doors, the model has 2 doors; 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer 1 is a solid drawer block | 20, $188.70, 0, 2, 2 hollow | pass |
| 32 (extra) | nightstand | 11, $117.81, 0, 1, 1 solid | FAIL: 16" slides on a 15 3/4" deep drawer box (it takes 14"); Drawer is a solid drawer block | 11, $117.81, 0, 1, 1 hollow | pass |

Before: 29/32 fail I31 or I32. After: 0/32 fail.

The bare kitchen island prompts (sweep 12, 13) had no doors or drawers before, so I31/I32 pass on both; they gain the base cabinet Chief asked for ("Default kitchen island has no doors or drawers"), which no invariant pins.
