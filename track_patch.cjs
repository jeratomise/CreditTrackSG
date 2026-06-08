const fs = require('fs');
let s = fs.readFileSync('api/server.ts', 'utf8');

const anchor = "      throw insertErr;\n    }\n\n    res.json({ success: true, referral });\n  } catch (err: any) {\n    console.error(\"Error tracking referral:\", err);\n    res.status(500).json({ error: err.message });";

if (!s.includes(anchor)) {
  console.log('Anchor not found');
  process.exit(1);
}

const addition = `      throw insertErr;
    }

    // Grant the referee 1 month of Pro (free) — expires automatically via daily cron
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, pro_expires_at')
      .eq('id', userData.user.id)
      .single();

    const existingExpiry = currentProfile?.pro_expires_at
      ? new Date(currentProfile.pro_expires_at)
      : null;
    const newExpiry = existingExpiry && existingExpiry > oneMonthFromNow
      ? existingExpiry
      : oneMonthFromNow;

    await supabase
      .from('profiles')
      .update({
        role: 'pro',
        pro_expires_at: newExpiry.toISOString(),
      })
      .eq('id', userData.user.id);

    res.json({
      success: true,
      referral,
      refereeReward: {
        monthsOfPro: 1,
        expiresAt: newExpiry.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Error tracking referral:", err);
    res.status(500).json({ error: err.message });`;

s = s.replace(anchor, addition);
fs.writeFileSync('api/server.ts', s);
console.log('Done');
