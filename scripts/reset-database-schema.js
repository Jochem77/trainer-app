// Script om database schema te resetten naar de originele schema.json data
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Lees schema.json
const schemaPath = path.join(process.cwd(), 'schema.json');
const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Supabase configuratie - zorg dat je environment variables hebt ingesteld
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY environment variables zijn vereist');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetDatabaseSchema() {
    try {
        console.log('🔄 Database schema resetten naar originele schema.json...');
        
        // Haal de huidige user op (je moet ingelogd zijn)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error('❌ Je moet ingelogd zijn om dit script uit te voeren');
            console.log('💡 Log eerst in via de web applicatie');
            process.exit(1);
        }
        
        console.log(`👤 Gebruiker gevonden: ${user.email}`);
        console.log(`📊 Schema.json bevat ${schemaData.length} weken met training data`);
        
        // Update of insert het schema in de database
        const { data, error } = await supabase
            .from('user_schemas')
            .upsert({
                user_id: user.id,
                schema_data: schemaData,
                schema_name: 'Origineel Trainingsschema',
                is_active: true,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,schema_name'
            });
            
        if (error) {
            // Probeer alternatieve aanpak als er een conflict is
            if (error.code === '23505' || error.message.includes('conflict')) {
                console.log('🔄 Conflict gedetecteerd, probeer UPDATE...');
                
                const { error: updateError } = await supabase
                    .from('user_schemas')
                    .update({
                        schema_data: schemaData,
                        schema_name: 'Origineel Trainingsschema',
                        is_active: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id);
                    
                if (updateError) {
                    throw updateError;
                } else {
                    console.log('✅ Schema succesvol geüpdatet via UPDATE');
                }
            } else {
                throw error;
            }
        } else {
            console.log('✅ Schema succesvol geüpdatet via UPSERT');
        }
        
        // Verifieer dat de data correct is opgeslagen
        const { data: verifyData, error: verifyError } = await supabase
            .from('user_schemas')
            .select('schema_data, schema_name')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();
            
        if (verifyError) {
            console.warn('⚠️  Kan data niet verifiëren:', verifyError.message);
        } else if (verifyData) {
            console.log(`✅ Verificatie: ${verifyData.schema_data.length} weken opgeslagen`);
            console.log(`📝 Schema naam: ${verifyData.schema_name}`);
        }
        
        console.log('🎉 Database schema succesvol gereset!');
        console.log('💡 Je kunt nu de web applicatie vernieuwen om de wijzigingen te zien');
        
    } catch (error) {
        console.error('❌ Fout bij resetten database schema:', error);
        console.error('📋 Error details:', {
            message: error.message,
            code: error.code,
            details: error.details
        });
        process.exit(1);
    }
}

// Voer het script uit
resetDatabaseSchema();