/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private context: string;
  private static level: LogLevel = LogLevel.INFO; // Default level

  constructor(context: string) {
    this.context = context;
  }

  static setLogLevel(level: LogLevel) {
    Logger.level = level;
  }

  error(message: string, error?: any) {
    if (Logger.level >= LogLevel.ERROR) {
      console.error(`[ERROR][${this.context}] ${message}`, error || "");
    }
  }

  warn(message: string, data?: any) {
    if (Logger.level >= LogLevel.WARN) {
      console.warn(`[WARN][${this.context}] ${message}`, data || "");
    }
  }

  info(message: string, data?: any) {
    if (Logger.level >= LogLevel.INFO) {
      console.info(`[INFO][${this.context}] ${message}`, data || "");
    }
  }

  debug(message: string, data?: any) {
    if (Logger.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG][${this.context}] ${message}`, data || "");
    }
  }
}
