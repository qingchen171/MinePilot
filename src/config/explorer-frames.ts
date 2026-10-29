/** Registered source rectangles; four directions, each idle / left step / right step / observe. */
const frames = [
  {
    "x": 39,
    "row": 0,
    "y": 28,
    "width": 259,
    "height": 267,
    "column": 0
  },
  {
    "x": 354,
    "row": 0,
    "y": 29,
    "width": 254,
    "height": 265,
    "column": 1
  },
  {
    "x": 655,
    "row": 0,
    "y": 29,
    "width": 252,
    "height": 265,
    "column": 2
  },
  {
    "x": 982,
    "row": 0,
    "y": 29,
    "width": 230,
    "height": 264,
    "column": 3
  },
  {
    "x": 64,
    "row": 1,
    "y": 334,
    "width": 247,
    "height": 268,
    "column": 0
  },
  {
    "x": 389,
    "row": 1,
    "y": 333,
    "width": 247,
    "height": 270,
    "column": 1
  },
  {
    "x": 695,
    "row": 1,
    "y": 334,
    "width": 254,
    "height": 268,
    "column": 2
  },
  {
    "x": 1020,
    "row": 1,
    "y": 334,
    "width": 218,
    "height": 267,
    "column": 3
  },
  {
    "x": 39,
    "row": 2,
    "y": 633,
    "width": 253,
    "height": 264,
    "column": 0
  },
  {
    "x": 358,
    "row": 2,
    "y": 634,
    "width": 249,
    "height": 263,
    "column": 1
  },
  {
    "x": 671,
    "row": 2,
    "y": 632,
    "width": 247,
    "height": 266,
    "column": 2
  },
  {
    "x": 978,
    "row": 2,
    "y": 633,
    "width": 250,
    "height": 264,
    "column": 3
  },
  {
    "x": 62,
    "row": 3,
    "y": 931,
    "width": 237,
    "height": 269,
    "column": 0
  },
  {
    "x": 392,
    "row": 3,
    "y": 933,
    "width": 239,
    "height": 266,
    "column": 1
  },
  {
    "x": 704,
    "row": 3,
    "y": 931,
    "width": 249,
    "height": 270,
    "column": 2
  },
  {
    "x": 1020,
    "row": 3,
    "y": 930,
    "width": 223,
    "height": 270,
    "column": 3
  }
] as const;
export default frames;
