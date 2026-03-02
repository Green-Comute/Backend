/**
 * @fileoverview Socket.io Instance Manager
 * @description Provides singleton pattern for Socket.io instance management.
 * Enables controllers and services to emit real-time events.
 * @module config/socket
 */

/**
 * Socket.io Instance Storage
 * @private
 * @type {Object|null}
 */
let ioInstance = null;

/**
 * Set Socket.io Instance
 * 
 * @description Initializes the Socket.io instance for global use.
 * Called once during server startup.
 * 
 * @param {Object} io - Socket.io server instance
 * 
 * @example
 * import { Server } from 'socket.io';
 * import { setIO } from './config/socket.js';
 * 
 * const io = new Server(httpServer);
 * setIO(io);
 */
export const setIO = (io) => {
  ioInstance = io;
};

/**
 * Get Socket.io Instance
 * 
 * @description Retrieves the Socket.io instance for emitting events.
 * Used by controllers to send real-time notifications.
 * 
 * @returns {Object} Socket.io server instance
 * @throws {Error} If Socket.io not initialized
 * 
 * @example
 * import { getIO } from '../config/socket.js';
 * 
 * const io = getIO();
 * io.to(`user-${userId}`).emit('notification', { message: 'Hello' });
 */
export const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized');
  }
  return ioInstance;
};
