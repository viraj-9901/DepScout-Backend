import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

/**
 * Validate package.json path if provided
 */
export const validatePackageJsonPath = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const packageJsonPath = req.body.packageJsonPath || req.query.packageJsonPath;

    if (packageJsonPath) {
      // Check if file exists
      if (!fs.existsSync(packageJsonPath as string)) {
        res.status(400).json({
          success: false,
          message: `package.json not found at path: ${packageJsonPath}`
        });
        return;
      }

      // Check if it's actually a package.json file
      const fileName = path.basename(packageJsonPath as string);
      if (fileName !== 'package.json') {
        res.status(400).json({
          success: false,
          message: 'File must be named package.json'
        });
        return;
      }

      // Try to parse the file
      try {
        const content = fs.readFileSync(packageJsonPath as string, 'utf8');
        JSON.parse(content);
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid package.json format'
        });
        return;
      }
    } else {
      // If no path provided, check if package.json exists in current directory
      const defaultPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(defaultPath)) {
        res.status(400).json({
          success: false,
          message: 'package.json not found in current directory. Please provide packageJsonPath.'
        });
        return;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate version check request
 */
export const validateVersionCheck = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { version, range } = req.body;

    if (!version) {
      res.status(400).json({
        success: false,
        message: 'version is required'
      });
      return;
    }

    if (!range) {
      res.status(400).json({
        success: false,
        message: 'range is required'
      });
      return;
    }

    // Basic validation for version format
    if (typeof version !== 'string' || typeof range !== 'string') {
      res.status(400).json({
        success: false,
        message: 'version and range must be strings'
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate output path for save operations
 */
export const validateOutputPath = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { outputPath } = req.body;

    if (outputPath) {
      // Check if directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        res.status(400).json({
          success: false,
          message: `Output directory does not exist: ${dir}`
        });
        return;
      }

      // Check if it's a JSON file
      if (!outputPath.endsWith('.json')) {
        res.status(400).json({
          success: false,
          message: 'Output file must be a .json file'
        });
        return;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Global error handler for analyzer routes
 */
export const analyzerErrorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Analyzer Error:', error);

  // Handle specific error types
  if (error.message.includes('package.json')) {
    res.status(400).json({
      success: false,
      message: error.message
    });
    return;
  }

  if (error.message.includes('npm')) {
    res.status(500).json({
      success: false,
      message: 'NPM command failed. Make sure npm is installed and accessible.',
      error: error.message
    });
    return;
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'An error occurred while analyzing dependencies',
    error: config.env === 'development' ? error.message : undefined
  });
};

export const validatePackageJsonData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { dependencies, devDependencies } = req.body;

    if (!dependencies && !devDependencies) {
      res.status(400).json({
        success: false,
        error: 'At least one of dependencies or devDependencies is required'
      });
      return;
    }

    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid package.json data'
    });
  }
};
