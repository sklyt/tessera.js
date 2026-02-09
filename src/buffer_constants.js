// buffer_constants.js

// Camera state (9 floats = 9 u32s when reinterpreted)
export const CTRL_CAM_WORLD_X = 0;      // f32
export const CTRL_CAM_WORLD_Y = 1;      // f32
export const CTRL_CAM_ZOOM = 2;         // f32
export const CTRL_CAM_VIEW_WIDTH = 3;   // f32
export const CTRL_CAM_VIEW_HEIGHT = 4;  // f32
export const CTRL_CAM_ROTATION = 5;     // f32 (radians)
export const CTRL_CAM_FRUSTUM_LEFT = 6;   // f32
export const CTRL_CAM_FRUSTUM_RIGHT = 7;  // f32
export const CTRL_CAM_FRUSTUM_TOP = 8;    // f32
export const CTRL_CAM_FRUSTUM_BOTTOM = 9; // f32

// Buffer control (shifted by camera size)
export const CTRL_JS_WRITE_IDX = 10;
export const CTRL_CPP_READ_IDX = 11;
export const CTRL_GPU_RENDER_IDX = 12;
export const CTRL_DIRTY_FLAG = 13;
export const CTRL_DIRTY_COUNT = 14;
export const CTRL_DIRTY_REGIONS = 15;

export const MAX_DIRTY_REGIONS = 256;

// Total size: 10 cam + 5 ctrl + (256 * 4) regions = 1039 u32s = 4156 bytes
export const CONTROL_BUFFER_SIZE = (10 + 5 + MAX_DIRTY_REGIONS * 4) * 4;