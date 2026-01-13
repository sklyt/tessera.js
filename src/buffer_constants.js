export const CTRL_JS_WRITE_IDX = 0;
export const CTRL_CPP_READ_IDX = 1;
export const CTRL_GPU_RENDER_IDX = 2;
export const CTRL_DIRTY_FLAG = 3;
export const CTRL_DIRTY_COUNT = 4;
export const CTRL_DIRTY_REGIONS = 5;
export const MAX_DIRTY_REGIONS = 256;

// control buffer size in bytes
export const CONTROL_BUFFER_SIZE = (5 + MAX_DIRTY_REGIONS * 4) * 4;  // 4116 bytes