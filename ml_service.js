const tf = require('tensorflow');
const sklearn = require('scikit-learn');
const pd = require('pandas');
const np = require('numpy');

class MLService {
    constructor() {
        this.model = null;
        this.scaler = null;
    }

    async trainRacePredictionModel(historicalData) {
        try {
            // Convert data to pandas DataFrame
            const df = pd.DataFrame(historicalData);
            
            // Feature engineering
            const features = df[['circuit_id', 'weather_conditions', 'track_temperature', 'air_temperature']];
            const target = df['race_result'];
            
            // Scale features
            this.scaler = new sklearn.preprocessing.StandardScaler();
            const scaledFeatures = this.scaler.fit_transform(features);
            
            // Create and train model
            this.model = new tf.keras.Sequential([
                tf.keras.layers.Dense(64, activation='relu', input_shape=[features.shape[1]]),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(32, activation='relu'),
                tf.keras.layers.Dense(1, activation='sigmoid')
            ]);
            
            this.model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy']);
            await this.model.fit(scaledFeatures, target, epochs=50, batch_size=32);
            
            return { success: true, message: 'Model trained successfully' };
        } catch (error) {
            console.error('Error training model:', error);
            return { success: false, error: error.message };
        }
    }

    async predictRaceOutcome(raceData) {
        try {
            if (!this.model || !this.scaler) {
                throw new Error('Model not trained yet');
            }
            
            // Scale input data
            const scaledData = this.scaler.transform(raceData);
            
            // Make prediction
            const prediction = this.model.predict(scaledData);
            
            return {
                success: true,
                prediction: prediction[0],
                confidence: Math.max(...prediction[0])
            };
        } catch (error) {
            console.error('Error making prediction:', error);
            return { success: false, error: error.message };
        }
    }

    async analyzeDriverPerformance(driverData) {
        try {
            // Convert to DataFrame
            const df = pd.DataFrame(driverData);
            
            // Calculate performance metrics
            const performanceMetrics = {
                averagePosition: df['position'].mean(),
                consistency: df['position'].std(),
                improvementRate: this.calculateImprovementRate(df),
                reliability: this.calculateReliability(df)
            };
            
            return {
                success: true,
                metrics: performanceMetrics
            };
        } catch (error) {
            console.error('Error analyzing driver performance:', error);
            return { success: false, error: error.message };
        }
    }

    calculateImprovementRate(df) {
        const positions = df['position'].values;
        let improvements = 0;
        for (let i = 1; i < positions.length; i++) {
            if (positions[i] < positions[i-1]) {
                improvements++;
            }
        }
        return improvements / (positions.length - 1);
    }

    calculateReliability(df) {
        const totalRaces = df.shape[0];
        const finishedRaces = df[df['status'] === 'Finished'].shape[0];
        return finishedRaces / totalRaces;
    }
}

module.exports = new MLService(); 